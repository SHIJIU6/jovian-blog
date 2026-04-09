import { NextResponse } from 'next/server'
import { getSiteConfig } from '@/lib/server/content/structured'

export const dynamic = 'force-dynamic'

/**
 * Reference: Next.js App Router route handlers (current project uses Next.js 16.0.10).
 * Browsers still probe `/favicon.ico`, so we redirect that legacy path to the active site favicon config.
 */
export async function GET(request: Request) {
	const { siteContent } = await getSiteConfig()
	const target = siteContent.faviconUrl || '/favicon.png'
	const url = new URL(target, request.url)

	return NextResponse.redirect(url, {
		status: 307,
		headers: {
			'Cache-Control': 'no-store'
		}
	})
}
