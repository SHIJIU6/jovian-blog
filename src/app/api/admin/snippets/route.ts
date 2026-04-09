import { saveSnippets } from '@/lib/server/content/structured'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()
	await saveSnippets(payload.snippets || [])
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'snippets.save',
		targetType: 'snippets',
		payload: {
			count: Array.isArray(payload.snippets) ? payload.snippets.length : 0
		}
	})
	return Response.json({ success: true })
}
