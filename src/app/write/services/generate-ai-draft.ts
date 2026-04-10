import type { PublishForm } from '../types'

export type GenerateAiDraftPayload = {
	topic: string
	angle?: string
	audience?: string
	tone?: string
	withWebResearch: boolean
}

export type GenerateAiDraftResult = {
	jobId: string
	result: {
		provider: 'openai' | 'mock'
		title: string
		slug: string
		summary: string
		category: string
		tags: string[]
		markdown: string
		sources: Array<{
			title: string
			url: string
			note: string
		}>
	}
}

export async function generateAiDraft(payload: GenerateAiDraftPayload): Promise<GenerateAiDraftResult> {
	const response = await fetch('/api/admin/ai/generate-post', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	})

	if (!response.ok) {
		const errorPayload = await response.json().catch(() => ({}))
		throw new Error(errorPayload.error || 'AI draft request failed')
	}

	return response.json()
}

export function toPublishForm(result: GenerateAiDraftResult['result']): Partial<PublishForm> {
	return {
		title: result.title,
		slug: result.slug,
		summary: result.summary,
		category: result.category,
		tags: result.tags,
		md: result.markdown,
		hidden: true
	}
}
