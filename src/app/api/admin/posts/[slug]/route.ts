import { deletePost } from '@/lib/server/admin/posts'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
	const auth = await evaluateAdminRequest(_request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const params = await context.params
	await deletePost(params.slug)
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'post.delete',
		targetType: 'post',
		targetId: params.slug
	})
	return Response.json({ success: true })
}
