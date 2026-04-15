import { updateAuthoringAboutPage } from '@/lib/server/admin/structured-authoring'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { toAuthoringErrorResponse } from '@/lib/server/admin/route-response'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const payload = await request.json()
		await updateAuthoringAboutPage(payload, auth.email)
		return Response.json({ success: true })
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}
