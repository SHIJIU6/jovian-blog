export type SnippetItem = {
	id: string
	content: string
}

function normalizeText(value: unknown) {
	return typeof value === 'string' ? value.trim() : ''
}

function normalizeSegment(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 36)
}

function hashText(input: string) {
	let hash = 2166136261
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0).toString(36)
}

function fallbackIdSuffix() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

export function createContentItemId(kind: string) {
	return `${kind}-${fallbackIdSuffix()}`
}

export function ensureContentItemId(kind: string, currentId: unknown, ...parts: Array<unknown>) {
	const normalizedCurrentId = normalizeText(currentId)
	if (normalizedCurrentId) return normalizedCurrentId

	const normalizedParts = parts.map(normalizeText).filter(Boolean)
	if (normalizedParts.length === 0) {
		return createContentItemId(kind)
	}

	const label = normalizeSegment(normalizedParts[0]) || 'item'
	return `${kind}-${label}-${hashText(normalizedParts.join('||'))}`
}

export function normalizeProjectId(project: { id?: string; name?: string; url?: string; description?: string }) {
	return ensureContentItemId('project', project.id, project.url, project.name, project.description)
}

export function normalizeShareId(share: { id?: string; name?: string; url?: string; description?: string }) {
	return ensureContentItemId('share', share.id, share.url, share.name, share.description)
}

export function normalizeBloggerId(blogger: { id?: string; name?: string; url?: string; description?: string }) {
	return ensureContentItemId('blogger', blogger.id, blogger.url, blogger.name, blogger.description)
}

export function normalizeSnippetItems(items: Array<SnippetItem | string>) {
	const occurrenceMap = new Map<string, number>()

	return items.map(item => {
		if (typeof item === 'string') {
			const content = item.trim()
			const occurrence = (occurrenceMap.get(content) || 0) + 1
			occurrenceMap.set(content, occurrence)
			return {
				id: ensureContentItemId('snippet', '', content, String(occurrence)),
				content
			}
		}

		const content = normalizeText(item.content)
		const occurrence = (occurrenceMap.get(content) || 0) + 1
		occurrenceMap.set(content, occurrence)
		return {
			id: ensureContentItemId('snippet', item.id, content, String(occurrence)),
			content
		}
	})
}
