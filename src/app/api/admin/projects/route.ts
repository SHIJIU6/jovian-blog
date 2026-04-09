import { saveProjects } from '@/lib/server/content/structured'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()
	await saveProjects(payload.projects || [])
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'projects.save',
		targetType: 'projects',
		payload: {
			count: Array.isArray(payload.projects) ? payload.projects.length : 0
		}
	})
	return Response.json({ success: true })
}
