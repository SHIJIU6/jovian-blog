import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { generateDraft } from '@/lib/server/ai'

export const dynamic = 'force-dynamic'

function badRequest(message: string, status = 400) {
	return Response.json({ error: message }, { status })
}

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()
	const topic = typeof payload?.topic === 'string' ? payload.topic.trim() : ''

	if (!topic) {
		return badRequest('缺少主题，无法生成草稿')
	}

	if (topic.length > 200) {
		return badRequest('主题过长，请控制在 200 个字符以内')
	}

	const result = await generateDraft({
		topic,
		angle: typeof payload?.angle === 'string' ? payload.angle.trim() : undefined,
		audience: typeof payload?.audience === 'string' ? payload.audience.trim() : undefined,
		tone: typeof payload?.tone === 'string' ? payload.tone.trim() : undefined,
		withWebResearch: payload?.withWebResearch !== false
	})

	return Response.json(result)
}
