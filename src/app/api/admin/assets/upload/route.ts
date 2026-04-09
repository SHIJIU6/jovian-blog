import { saveAsset } from '@/lib/server/admin/assets'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const form = await request.formData()
	const file = form.get('file')
	const folder = String(form.get('folder') || 'misc')
	const key = form.get('key')

	if (!(file instanceof File)) {
		return Response.json({ error: 'Missing file' }, { status: 400 })
	}

	const result = await saveAsset(file, folder, typeof key === 'string' && key.length > 0 ? key : undefined)
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'asset.upload',
		targetType: 'asset',
		targetId: result.id || result.key,
		payload: {
			key: result.key,
			filename: file.name,
			contentType: file.type || 'application/octet-stream',
			size: file.size,
			folder
		}
	})
	return Response.json(result)
}
