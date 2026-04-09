import { saveSiteConfig } from '@/lib/server/content/structured'
import { createUnauthorizedAdminResponse, evaluateAdminRequest } from '@/lib/server/admin/auth'
import { writeAuditLog } from '@/lib/server/admin/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const auth = await evaluateAdminRequest(request, process.env.ADMIN_ALLOWLIST)
	if (!auth.ok) return createUnauthorizedAdminResponse(auth.reason || 'unauthorized')

	const payload = await request.json()
	await saveSiteConfig({
		siteContent: payload.siteContent,
		cardStyles: payload.cardStyles
	})
	await writeAuditLog({
		actorEmail: auth.email || 'local-dev',
		action: 'site-config.save',
		targetType: 'site_config',
		payload: {
			title: payload?.siteContent?.title,
			socialButtonCount: Array.isArray(payload?.siteContent?.socialButtons) ? payload.siteContent.socialButtons.length : 0,
			artImageCount: Array.isArray(payload?.siteContent?.artImages) ? payload.siteContent.artImages.length : 0,
			backgroundImageCount: Array.isArray(payload?.siteContent?.backgroundImages) ? payload.siteContent.backgroundImages.length : 0
		}
	})
	return Response.json({ success: true })
}
