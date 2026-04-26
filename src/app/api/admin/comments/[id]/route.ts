import { NextRequest, NextResponse } from 'next/server'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { updateCommentStatus } from '@/lib/server/comments'
import type { CommentStatus } from '@/lib/comment-types'

export const dynamic = 'force-dynamic'

const COMMENT_STATUSES = ['pending', 'approved', 'spam', 'deleted'] as const

function parseStatus(value: unknown): CommentStatus | null {
	return typeof value === 'string' && (COMMENT_STATUSES as readonly string[]).includes(value) ? (value as CommentStatus) : null
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json().catch(() => ({}))
	const status = parseStatus(payload?.status)
	if (!status) return NextResponse.json({ error: 'Invalid comment status' }, { status: 400 })

	try {
		const params = await context.params
		const item = await updateCommentStatus(params.id, status)
		return NextResponse.json({ item })
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || '留言处理失败' }, { status: 400 })
	}
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const params = await context.params
		const item = await updateCommentStatus(params.id, 'deleted')
		return NextResponse.json({ item })
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || '留言删除失败' }, { status: 400 })
	}
}
