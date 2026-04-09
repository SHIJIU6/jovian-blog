import { listContentCategories } from '@/lib/server/content'

export const dynamic = 'force-dynamic'

export async function GET() {
	const categories = await listContentCategories()
	return Response.json(categories)
}
