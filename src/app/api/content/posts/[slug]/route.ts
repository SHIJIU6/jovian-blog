import { NextRequest } from 'next/server'
import { getContentPost } from '@/lib/server/content'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
	const params = await context.params
	const includeHidden = request.nextUrl.searchParams.get('includeHidden') === 'true'
	const post = await getContentPost(params.slug, { includeHidden })

	if (!post) {
		return Response.json({ error: 'Not found' }, { status: 404 })
	}

	return Response.json(post)
}
