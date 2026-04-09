import { savePost, syncPostIndex } from '@/lib/server/admin/posts'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()

	if (payload?.action === 'sync') {
		await syncPostIndex({
			originalItems: payload.originalItems || [],
			nextItems: payload.nextItems || [],
			categories: payload.categories || []
		})
		await writeAuditLog({
			actorEmail: auth.email || 'local-dev',
			action: 'posts.sync',
			targetType: 'post_index',
			payload: {
				originalCount: Array.isArray(payload.originalItems) ? payload.originalItems.length : 0,
				nextCount: Array.isArray(payload.nextItems) ? payload.nextItems.length : 0,
				categoryCount: Array.isArray(payload.categories) ? payload.categories.length : 0
			}
		})
		return Response.json({ success: true })
	}

	const result = await savePost({
		slug: payload.slug,
		title: payload.title,
		summary: payload.summary,
		contentMd: payload.contentMd,
		tags: payload.tags || [],
		category: payload.category,
		coverUrl: payload.coverUrl,
		hidden: payload.hidden,
		date: payload.date
	})
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'post.save',
		targetType: 'post',
		targetId: payload.slug,
		payload: {
			title: payload.title,
			hidden: Boolean(payload.hidden),
			tagCount: Array.isArray(payload.tags) ? payload.tags.length : 0,
			hasCover: Boolean(payload.coverUrl),
			contentLength: typeof payload.contentMd === 'string' ? payload.contentMd.length : 0
		}
	})

	return Response.json({ success: true, post: result })
}
