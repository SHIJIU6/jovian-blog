import { updateAuthoringSiteConfigSection } from '@/lib/server/admin/structured-authoring'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { parseSiteConfigSection, toAuthoringErrorResponse } from '@/lib/server/admin/route-response'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ section: string }> }) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	try {
		const params = await context.params
		const section = parseSiteConfigSection(params.section)
		const payload = await request.json()
		return Response.json(await updateAuthoringSiteConfigSection(section, payload, auth.email))
	} catch (error) {
		return toAuthoringErrorResponse(error)
	}
}
