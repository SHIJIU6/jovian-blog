import { getPaginatedBloggers } from '@/lib/server/content/structured'
import { normalizePagination } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	const url = new URL(request.url)
	return Response.json(
		await getPaginatedBloggers(
			normalizePagination({
				page: url.searchParams.get('page'),
				pageSize: url.searchParams.get('pageSize'),
				limit: url.searchParams.get('limit')
			})
		)
	)
}
