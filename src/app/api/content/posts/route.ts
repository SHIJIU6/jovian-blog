import { NextRequest } from 'next/server'
import { listContentPosts } from '@/lib/server/content'
import { normalizePagination } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
	const includeHidden = request.nextUrl.searchParams.get('includeHidden') === 'true'
	const pagination = normalizePagination({
		page: request.nextUrl.searchParams.get('page'),
		pageSize: request.nextUrl.searchParams.get('pageSize'),
		limit: request.nextUrl.searchParams.get('limit')
	})

	const items = await listContentPosts({
		includeHidden,
		limit: pagination.pageSize + 1,
		offset: pagination.offset
	})

	return Response.json({
		items: items.slice(0, pagination.pageSize),
		page: pagination.page,
		pageSize: pagination.pageSize,
		hasMore: items.length > pagination.pageSize
	})
}
