import { NextRequest, NextResponse } from 'next/server'
import { EMPTY_LIKE_STATE } from '@/lib/like-types'
import { getLikeStates } from '@/lib/server/likes'

export const dynamic = 'force-dynamic'

const CLIENT_COOKIE_NAME = 'blog-like-client'
const CLIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function normalizeTargetKeys(input: unknown) {
	if (!Array.isArray(input)) return []
	return Array.from(
		new Set(
			input
				.map(item => (typeof item === 'string' ? item.trim() : ''))
				.filter(Boolean)
		)
	)
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

export async function POST(request: NextRequest) {
	const payload = await request.json().catch(() => ({}))
	const targetKeys = normalizeTargetKeys(payload?.keys)
	if (targetKeys.length === 0) {
		return NextResponse.json({})
	}

	const client = await getClientContext(request)
	const states = await getLikeStates(targetKeys, client.fingerprint)
	const normalizedStates = Object.fromEntries(targetKeys.map(targetKey => [targetKey, states[targetKey] || EMPTY_LIKE_STATE]))
	const response = NextResponse.json(normalizedStates)
	applyClientCookie(response, client.clientId, client.shouldSetCookie)
	return response
}
