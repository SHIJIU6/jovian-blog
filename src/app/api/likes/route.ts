import { NextRequest, NextResponse } from 'next/server'
import { getLikeState, registerLike } from '@/lib/server/likes'

export const dynamic = 'force-dynamic'

const CLIENT_COOKIE_NAME = 'blog-like-client'
const CLIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function getTargetKey(request: NextRequest) {
	return (request.nextUrl.searchParams.get('slug') || request.nextUrl.searchParams.get('key') || '').trim()
}

function getClientSeed(request: NextRequest, clientId: string) {
	const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || ''
	const userAgent = request.headers.get('user-agent') || ''
	const language = request.headers.get('accept-language') || ''
	return [clientId, forwardedFor, userAgent, language].filter(Boolean).join('|') || clientId
}

async function hashText(value: string) {
	const input = new TextEncoder().encode(value)
	const digest = await crypto.subtle.digest('SHA-256', input)
	return Array.from(new Uint8Array(digest))
		.map(item => item.toString(16).padStart(2, '0'))
		.join('')
}

async function getClientContext(request: NextRequest) {
	const cookieValue = request.cookies.get(CLIENT_COOKIE_NAME)?.value?.trim()
	const clientId = cookieValue || crypto.randomUUID()

	return {
		clientId,
		shouldSetCookie: !cookieValue,
		fingerprint: await hashText(getClientSeed(request, clientId))
	}
}

function applyClientCookie(response: NextResponse, clientId: string, shouldSetCookie: boolean) {
	if (!shouldSetCookie) return

	response.cookies.set({
		name: CLIENT_COOKIE_NAME,
		value: clientId,
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: CLIENT_COOKIE_MAX_AGE
	})
}

function createInvalidRequestResponse() {
	return NextResponse.json({ error: 'Missing target key' }, { status: 400 })
}

export async function GET(request: NextRequest) {
	const targetKey = getTargetKey(request)
	if (!targetKey) return createInvalidRequestResponse()

	const client = await getClientContext(request)
	const state = await getLikeState(targetKey, client.fingerprint)
	const response = NextResponse.json(state)
	applyClientCookie(response, client.clientId, client.shouldSetCookie)
	return response
}

export async function POST(request: NextRequest) {
	const targetKey = getTargetKey(request)
	if (!targetKey) return createInvalidRequestResponse()

	const client = await getClientContext(request)
	const result = await registerLike(targetKey, client.fingerprint)
	const response = NextResponse.json(result)
	applyClientCookie(response, client.clientId, client.shouldSetCookie)
	return response
}
