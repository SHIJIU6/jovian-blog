import { NextRequest } from 'next/server'
import { listContentPosts } from '@/lib/server/content'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
	const includeHidden = request.nextUrl.searchParams.get('includeHidden') === 'true'
	const limitParam = request.nextUrl.searchParams.get('limit')
	const limit = limitParam ? Number(limitParam) : undefined

	const items = await listContentPosts({
		includeHidden,
		limit: Number.isFinite(limit) ? limit : undefined
	})

	return Response.json(items)
}
