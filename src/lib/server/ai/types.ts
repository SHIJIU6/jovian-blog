export type AiSourceItem = {
	title: string
	url: string
	note: string
}

export type AiResearchResult = {
	provider: 'openai' | 'mock'
	summary: string
	angle: string
	bulletPoints: string[]
	category: string
	tags: string[]
	sources: AiSourceItem[]
}

export type AiDraftResult = {
	provider: 'openai' | 'mock'
	title: string
	slug: string
	summary: string
	category: string
	tags: string[]
	markdown: string
	sources: AiSourceItem[]
}

export type ResearchTopicInput = {
	topic: string
	angle?: string
	audience?: string
	tone?: string
	withWebResearch?: boolean
}

export type GenerateDraftInput = ResearchTopicInput & {
	research?: AiResearchResult | null
}
