import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'
import { publishDraftFromTool } from '@/lib/server/admin/external-authoring'

export const dynamic = 'force-dynamic'

function badRequest(message: string, status = 400) {
	return Response.json({ error: message }, { status })
}

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()
	const slug = typeof payload?.slug === 'string' ? payload.slug.trim() : ''

	if (!slug) {
		return badRequest('缺少 slug，无法发布草稿')
	}

	const result = await publishDraftFromTool(slug)
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'post.publish_draft_external',
		targetType: 'post',
		targetId: result.slug,
		payload: {
			title: result.title
		}
	})

	return Response.json({ success: true, post: result })
}
