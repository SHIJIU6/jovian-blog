import { NextRequest, NextResponse } from 'next/server'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { listAllComments } from '@/lib/server/comments'
import { isCommentTargetType, type CommentStatus } from '@/lib/comment-types'

export const dynamic = 'force-dynamic'

const COMMENT_STATUSES = ['pending', 'approved', 'spam', 'deleted'] as const

function parseStatus(value: string | null): CommentStatus | 'all' | undefined {
	if (!value || value === 'all') return 'all'
	return (COMMENT_STATUSES as readonly string[]).includes(value) ? (value as CommentStatus) : undefined
}

function parseTargetType(value: string | null) {
	if (!value || value === 'all') return 'all'
	return isCommentTargetType(value) ? value : undefined
}

export async function GET(request: NextRequest) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const page = Math.max(Number(request.nextUrl.searchParams.get('page') || 1), 1)
	const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize') || request.nextUrl.searchParams.get('limit') || 10), 1), 100)
	const status = parseStatus(request.nextUrl.searchParams.get('status'))
	const targetType = parseTargetType(request.nextUrl.searchParams.get('targetType'))
	const targetId = request.nextUrl.searchParams.get('targetId') || undefined
	const query = request.nextUrl.searchParams.get('query') || undefined

	const items = await listAllComments({
		limit: pageSize + 1,
		offset: (page - 1) * pageSize,
		status,
		targetType,
		targetId,
		query
	})

	return NextResponse.json({
		items: items.slice(0, pageSize),
		page,
		pageSize,
		hasMore: items.length > pageSize
	})
}
