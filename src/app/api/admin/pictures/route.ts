import { savePictures } from '@/lib/server/content/structured'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()
	await savePictures(payload.pictures || [])
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'pictures.save',
		targetType: 'pictures',
		payload: {
			count: Array.isArray(payload.pictures) ? payload.pictures.length : 0
		}
	})
	return Response.json({ success: true })
}
