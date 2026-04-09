import { listAuditLogs } from '@/lib/server/admin/audit'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const { searchParams } = new URL(request.url)
	const limit = Number(searchParams.get('limit') || 50)
	const logs = await listAuditLogs(limit)

	return Response.json({
		logs,
		access: {
			email: auth.email,
			role: auth.role,
			source: auth.source
		}
	})
}
