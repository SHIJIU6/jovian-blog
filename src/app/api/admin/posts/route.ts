import { savePost, syncPostIndex } from '@/lib/server/admin/posts'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

function normalizePostSlug(value: unknown) {
	const raw = typeof value === 'string' ? value.trim() : ''
	const normalized = raw
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return normalized || `post-${Date.now()}`
}

function normalizePostText(value: unknown, fallback = '') {
	return typeof value === 'string' ? value : fallback
}

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

	const slug = normalizePostSlug(payload.slug || payload.title)
	const title = normalizePostText(payload.title, '未命名文章') || '未命名文章'
	const contentMd = normalizePostText(payload.contentMd)
	const result = await savePost({
		slug,
		title,
		summary: normalizePostText(payload.summary),
		contentMd,
		tags: Array.isArray(payload.tags) ? payload.tags : [],
		category: payload.category,
		coverUrl: payload.coverUrl,
		hidden: payload.hidden,
		date: payload.date,
		status: payload.status
	})
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'post.save',
		targetType: 'post',
		targetId: slug,
		payload: {
			title,
			hidden: Boolean(payload.hidden),
			status: payload.status,
			tagCount: Array.isArray(payload.tags) ? payload.tags.length : 0,
			hasCover: Boolean(payload.coverUrl),
			contentLength: contentMd.length
		}
	})

	return Response.json({ success: true, post: result })
}
