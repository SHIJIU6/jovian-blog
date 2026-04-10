export function normalizeRouteSlug(value?: string | string[]) {
	const raw = Array.isArray(value) ? value[0] : value
	if (!raw) return ''

	try {
		return decodeURIComponent(raw)
	} catch {
		return raw
	}
}
