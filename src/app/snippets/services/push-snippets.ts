import type { SnippetItem } from '@/lib/content-item-id'

export type PushSnippetsParams = {
	snippets: SnippetItem[]
}

export async function pushSnippets(params: PushSnippetsParams): Promise<void> {
	const response = await fetch('/api/admin/snippets', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(params)
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '保存失败')
	}
}
