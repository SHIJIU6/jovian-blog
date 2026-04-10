import { slugify } from '@/lib/markdown-renderer'
import type { AiDraftResult, AiResearchResult, GenerateDraftInput, ResearchTopicInput } from './types'

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'

type OpenAiResponsePayload = {
	output_text?: string
	output?: Array<{
		content?: Array<{
			text?: string | Record<string, unknown>
		}>
	}>
	usage?: Record<string, unknown>
	error?: {
		message?: string
	}
}

function getRequiredEnv(name: string) {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`)
	}
	return value
}

function readOutputText(payload: OpenAiResponsePayload) {
	if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
		return payload.output_text
	}

	const chunks: string[] = []
	for (const item of payload.output || []) {
		for (const content of item.content || []) {
			if (typeof content.text === 'string') {
				chunks.push(content.text)
			} else if (content.text && typeof content.text === 'object') {
				chunks.push(JSON.stringify(content.text))
			}
		}
	}

	return chunks.join('\n').trim()
}

async function createOpenAiResponse(body: Record<string, unknown>) {
	/**
	 * Reference: OpenAI Responses API + tools(web_search) + structured outputs docs checked on 2026-04-09.
	 * We keep the integration fetch-based so the current project does not need an extra SDK dependency
	 * while remaining production-compatible for Next.js route handlers.
	 */
	const response = await fetch(OPENAI_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${getRequiredEnv('OPENAI_API_KEY')}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	})

	const payload = (await response.json()) as OpenAiResponsePayload
	if (!response.ok) {
		throw new Error(payload.error?.message || `OpenAI request failed: ${response.status}`)
	}

	return payload
}

function getModel() {
	return process.env.OPENAI_RESPONSES_MODEL || 'gpt-5'
}

function ensureSourcesSection(markdown: string, sources: AiDraftResult['sources']) {
	if (sources.length === 0) return markdown
	if (markdown.includes('## 参考来源') || markdown.includes('## Sources')) return markdown

	const section = `\n\n## 参考来源\n\n${sources.map(item => `- [${item.title}](${item.url})：${item.note}`).join('\n')}`
	return `${markdown.trim()}${section}`
}

export async function openAiResearchTopic(input: ResearchTopicInput): Promise<AiResearchResult> {
	const tools = input.withWebResearch ? [{ type: 'web_search' }] : []
	const payload = await createOpenAiResponse({
		model: getModel(),
		input: [
			{
				role: 'system',
				content:
					'你是一个负责博客前期调研的研究助手。请围绕给定主题整理适合博客写作的研究摘要，并严格输出符合 JSON Schema 的内容。'
			},
			{
				role: 'user',
				content: `主题：${input.topic}\n角度：${input.angle || '请自行选择最适合博客写作的分析角度'}\n受众：${input.audience || '技术读者与独立博客作者'}\n语气：${input.tone || '理性、清晰、偏分析'}`
			}
		],
		tools,
		text: {
			format: {
				type: 'json_schema',
				name: 'research_result',
				strict: true,
				schema: {
					type: 'object',
					properties: {
						summary: { type: 'string' },
						angle: { type: 'string' },
						bulletPoints: {
							type: 'array',
							items: { type: 'string' }
						},
						category: { type: 'string' },
						tags: {
							type: 'array',
							items: { type: 'string' }
						},
						sources: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									title: { type: 'string' },
									url: { type: 'string' },
									note: { type: 'string' }
								},
								required: ['title', 'url', 'note'],
								additionalProperties: false
							}
						}
					},
					required: ['summary', 'angle', 'bulletPoints', 'category', 'tags', 'sources'],
					additionalProperties: false
				}
			}
		}
	})

	const parsed = JSON.parse(readOutputText(payload)) as Omit<AiResearchResult, 'provider'>
	return {
		provider: 'openai',
		summary: parsed.summary,
		angle: parsed.angle,
		bulletPoints: parsed.bulletPoints || [],
		category: parsed.category,
		tags: parsed.tags || [],
		sources: parsed.sources || []
	}
}

export async function openAiGenerateDraft(input: GenerateDraftInput): Promise<AiDraftResult> {
	const research = input.research ?? (await openAiResearchTopic(input))
	const tools = input.withWebResearch ? [{ type: 'web_search' }] : []
	const payload = await createOpenAiResponse({
		model: getModel(),
		input: [
			{
				role: 'system',
				content:
					'你是博客后台的写作助手。请根据主题和研究摘要生成一篇适合中文技术博客的 Markdown 草稿，并严格输出符合 JSON Schema 的内容。不要自动发布，不要省略 sources。'
			},
			{
				role: 'user',
				content: `主题：${input.topic}\n角度：${research.angle}\n受众：${input.audience || '技术读者与独立博客作者'}\n语气：${input.tone || '理性、清晰、偏分析'}\n研究摘要：${research.summary}\n关键点：${research.bulletPoints.join('；')}\n已有来源：${research.sources
					.map(item => `${item.title} ${item.url}`)
					.join('\n')}`
			}
		],
		tools,
		text: {
			format: {
				type: 'json_schema',
				name: 'blog_draft',
				strict: true,
				schema: {
					type: 'object',
					properties: {
						title: { type: 'string' },
						slug: { type: 'string' },
						summary: { type: 'string' },
						category: { type: 'string' },
						tags: {
							type: 'array',
							items: { type: 'string' }
						},
						markdown: { type: 'string' },
						sources: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									title: { type: 'string' },
									url: { type: 'string' },
									note: { type: 'string' }
								},
								required: ['title', 'url', 'note'],
								additionalProperties: false
							}
						}
					},
					required: ['title', 'slug', 'summary', 'category', 'tags', 'markdown', 'sources'],
					additionalProperties: false
				}
			}
		}
	})

	const parsed = JSON.parse(readOutputText(payload)) as Omit<AiDraftResult, 'provider'>
	return {
		provider: 'openai',
		title: parsed.title,
		slug: slugify(parsed.slug || parsed.title) || `draft-${Date.now()}`,
		summary: parsed.summary,
		category: parsed.category,
		tags: parsed.tags || [],
		sources: parsed.sources || research.sources,
		markdown: ensureSourcesSection(parsed.markdown, parsed.sources || research.sources)
	}
}
