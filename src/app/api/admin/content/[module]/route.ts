import {
	createContentAuthoringItem,
	listContentAuthoringItems
} from '@/lib/server/admin/structured-authoring'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { parseContentAuthoringModule, toAuthoringErrorResponse } from '@/lib/server/admin/route-response'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ module: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const params = await context.params
		const module = parseContentAuthoringModule(params.module)
		const url = new URL(request.url)
		const query = url.searchParams.get('query') || undefined
		const limitRaw = url.searchParams.get('limit')
		const limit = limitRaw ? Number(limitRaw) : undefined
		return Response.json(await listContentAuthoringItems(module, { query, limit: Number.isFinite(limit) ? limit : undefined }))
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}

export async function POST(request: Request, context: { params: Promise<{ module: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const params = await context.params
		const module = parseContentAuthoringModule(params.module)
		const payload = await request.json()
		return Response.json(await createContentAuthoringItem(module, payload, auth.email))
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}
