import { getContentBindings } from '@/lib/server/content/cloudflare'
import { readLocalMedia } from '@/lib/server/local-media'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
	const params = await context.params
	const key = params.key.join('/')
	const env = await getContentBindings()
	const object = await env?.BLOG_MEDIA?.get(key)

	if (object) {
		const headers = new Headers()
		object.writeHttpMetadata(headers)
		headers.set('etag', object.httpEtag)

		return new Response(object.body, {
			headers
		})
	}

	const local = await readLocalMedia(key)
	if (!local) {
		return new Response('Not found', { status: 404 })
	}

	return new Response(local.buffer, {
		headers: {
			'Content-Type': local.contentType,
			'Cache-Control': 'no-store'
		}
	})
}
