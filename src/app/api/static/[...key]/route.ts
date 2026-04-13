import { readLocalMedia } from '@/lib/server/local-media'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<any> }) {
	const params = await context.params
	const parts = Array.isArray(params?.key) ? params.key : []
	const asset = await readLocalMedia(parts.join('/'))

	if (!asset) {
		return new Response('Not found', { status: 404 })
	}

	return new Response(asset.buffer, {
		headers: {
			'Content-Type': asset.contentType,
			'Cache-Control': 'no-store'
		}
	})
}
