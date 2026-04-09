import { readLocalMedia } from '@/lib/server/local-media'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
	const params = await context.params
	const key = ['uploads', ...params.key].join('/')
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
