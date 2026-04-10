import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'
import { createDraftFromTool } from '@/lib/server/admin/external-authoring'

export const dynamic = 'force-dynamic'

function badRequest(message: string, status = 400) {
	return Response.json({ error: message }, { status })
}

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()

	if (!payload?.title && !payload?.topic && !payload?.discussion) {
		return badRequest('至少需要提供 title、topic 或 discussion 其中一个字段')
	}

	const result = await createDraftFromTool(payload)
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'post.create_draft_external',
		targetType: 'post',
		targetId: result.slug,
		payload: {
			title: result.title,
			hidden: result.hidden,
			status: result.status,
			tagCount: Array.isArray(payload?.tags) ? payload.tags.length : 0,
			hasDiscussion: Boolean(payload?.discussion),
			hasContentMd: Boolean(payload?.contentMd),
			sourceCount: Array.isArray(payload?.sources) ? payload.sources.length : 0
		}
	})

	return Response.json({ success: true, post: result })
}
