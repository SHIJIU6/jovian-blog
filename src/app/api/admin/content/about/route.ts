import { getAuthoringAboutPage, updateAuthoringAboutPage } from '@/lib/server/admin/structured-authoring'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { toAuthoringErrorResponse } from '@/lib/server/admin/route-response'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		return Response.json(await getAuthoringAboutPage())
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}

export async function PATCH(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const payload = await request.json()
		return Response.json(await updateAuthoringAboutPage(payload, auth.email))
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}
