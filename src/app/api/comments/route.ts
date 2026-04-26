import { NextRequest, NextResponse } from 'next/server'
import { createComment, listComments } from '@/lib/server/comments'

export const dynamic = 'force-dynamic'

function getClientIp(request: NextRequest) {
	return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
}

export async function GET(request: NextRequest) {
	const targetType = request.nextUrl.searchParams.get('targetType') || ''
	const targetId = request.nextUrl.searchParams.get('targetId') || ''
	const page = Math.max(Number(request.nextUrl.searchParams.get('page') || 1), 1)
	const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize') || request.nextUrl.searchParams.get('limit') || 10), 1), 50)
	const query = request.nextUrl.searchParams.get('query') || undefined

	try {
		const items = await listComments(targetType, targetId, {
			limit: pageSize + 1,
			offset: (page - 1) * pageSize,
			query
		})
		return NextResponse.json({
			items: items.slice(0, pageSize),
			page,
			pageSize,
			hasMore: items.length > pageSize
		})
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || '留言加载失败' }, { status: 400 })
	}
}

export async function POST(request: NextRequest) {
	const payload = await request.json().catch(() => ({}))
	if (payload && !payload.authorEmail && payload.email) {
		payload.authorEmail = payload.email
	}

	try {
		const item = await createComment(payload, {
			ip: getClientIp(request),
			userAgent: request.headers.get('user-agent') || ''
		})
		return NextResponse.json({ item, pending: item.status === 'pending' })
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || '留言提交失败' }, { status: 400 })
	}
}
