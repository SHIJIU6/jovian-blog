import { getSnippets } from '@/lib/server/content/structured'

export const dynamic = 'force-dynamic'

export async function GET() {
	return Response.json(await getSnippets())
}
