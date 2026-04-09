import type { ContentBindings } from './types'

/**
 * Reference: OpenNext Cloudflare `getCloudflareContext` docs (retrieved via Context7 against `@opennextjs/cloudflare` and aligned with current 1.18.x adapter usage).
 * Bindings are resolved lazily so local Node.js runs can fall back to file-based content without requiring Workers resources.
 */
export async function getContentBindings(): Promise<ContentBindings | null> {
	try {
		const mod = await import('@opennextjs/cloudflare')
		const context = await mod.getCloudflareContext({ async: true })
		return (context?.env ?? null) as ContentBindings | null
	} catch {
		return null
	}
}
