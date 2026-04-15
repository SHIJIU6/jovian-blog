import {
	deleteContentAuthoringItem,
	getContentAuthoringItem,
	updateContentAuthoringItem
} from '@/lib/server/admin/structured-authoring'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { parseContentAuthoringModule, toAuthoringErrorResponse } from '@/lib/server/admin/route-response'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ module: string; id: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const params = await context.params
		const module = parseContentAuthoringModule(params.module)
		return Response.json(await getContentAuthoringItem(module, params.id))
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}

export async function PATCH(request: Request, context: { params: Promise<{ module: string; id: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const params = await context.params
		const module = parseContentAuthoringModule(params.module)
		const payload = await request.json()
		return Response.json(await updateContentAuthoringItem(module, params.id, payload, auth.email))
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}

export async function DELETE(request: Request, context: { params: Promise<{ module: string; id: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const params = await context.params
		const module = parseContentAuthoringModule(params.module)
		return Response.json(await deleteContentAuthoringItem(module, params.id, auth.email))
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}
