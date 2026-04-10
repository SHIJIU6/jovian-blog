import { slugify } from '@/lib/markdown-renderer'
import { getContentPost } from '../content'
import { savePost } from './posts'
import { normalizeBlogStatus } from '@/lib/blog-status'

export type ExternalSourceInput = {
	title: string
	url: string
	note?: string
}

export type CreateDraftFromToolInput = {
	title?: string
	slug?: string
	summary?: string
	contentMd?: string
	discussion?: string
	topic?: string
	tags?: string[]
	category?: string
	coverUrl?: string
	date?: string
	publish?: boolean
	status?: string
	sources?: ExternalSourceInput[]
}

/**
 * Reference: Next.js 16 App Router route handlers + current project content pipeline.
 * This service exists so external tools (MCP/skills/agents) can create and publish posts
 * without coupling to the website editor implementation.
 */

function trimText(value?: string | null) {
	return typeof value === 'string' ? value.trim() : ''
}

function compactLines(value: string) {
	return value
		.split('\n')
		.map(line => line.trimEnd())
		.join('\n')
		.trim()
}

function buildSummary(input: CreateDraftFromToolInput) {
	const explicit = trimText(input.summary)
	if (explicit) return explicit

	const discussion = trimText(input.discussion)
	if (!discussion) return ''

	const normalized = discussion.replace(/\s+/g, ' ').trim()
	return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized
}

function buildTitle(input: CreateDraftFromToolInput) {
	const explicit = trimText(input.title)
	if (explicit) return explicit

	const topic = trimText(input.topic)
	if (topic) return topic

	const discussion = trimText(input.discussion)
	if (discussion) {
		const collapsed = discussion.replace(/\s+/g, ' ').trim()
		return collapsed.length > 40 ? `${collapsed.slice(0, 40)}...` : collapsed
	}

	return '未命名草稿'
}

function buildSlug(input: CreateDraftFromToolInput, title: string) {
	const preferred = trimText(input.slug)
	const next = preferred || slugify(title)
	return next || `draft-${Date.now()}`
}

function buildSourcesSection(sources: ExternalSourceInput[]) {
	if (sources.length === 0) return ''

	const lines = sources.map(source => {
		const title = trimText(source.title) || source.url
		const note = trimText(source.note)
		return `- [${title}](${source.url})${note ? `：${note}` : ''}`
	})

	return `\n\n## 参考来源\n\n${lines.join('\n')}`
}

function buildMarkdown(input: CreateDraftFromToolInput, title: string, sources: ExternalSourceInput[]) {
	const contentMd = compactLines(trimText(input.contentMd))
	if (contentMd) {
		return contentMd.includes('## 参考来源') ? contentMd : `${contentMd}${buildSourcesSection(sources)}`
	}

	const discussion = compactLines(trimText(input.discussion))
	const topic = trimText(input.topic)
	const intro = buildSummary(input)

	const parts = [
		`# ${title}`,
		intro ? `\n${intro}` : '',
		topic ? `\n## 主题\n\n${topic}` : '',
		discussion ? `\n## 讨论整理\n\n${discussion}` : '\n## 正文\n\n请在此补充正文内容。',
		buildSourcesSection(sources)
	]

	return parts.filter(Boolean).join('\n')
}

export async function createDraftFromTool(input: CreateDraftFromToolInput) {
	const title = buildTitle(input)
	const slug = buildSlug(input, title)
	const sources = Array.isArray(input.sources) ? input.sources.filter(item => trimText(item.url)) : []
	const markdown = buildMarkdown(input, title, sources)
	const status = normalizeBlogStatus(input.status, input.publish ? false : true)

	return savePost({
		slug,
		title,
		summary: buildSummary(input),
		contentMd: markdown,
		tags: Array.isArray(input.tags) ? input.tags.map(tag => tag.trim()).filter(Boolean) : [],
		category: trimText(input.category) || undefined,
		coverUrl: trimText(input.coverUrl) || undefined,
		hidden: status !== 'published',
		status,
		date: trimText(input.date) || new Date().toISOString()
	})
}

export async function publishDraftFromTool(slug: string) {
	const normalizedSlug = trimText(slug)
	if (!normalizedSlug) {
		throw new Error('缺少 slug，无法发布草稿')
	}

	const post = await getContentPost(normalizedSlug, { includeHidden: true })
	if (!post) {
		throw new Error('未找到对应草稿')
	}

	return savePost({
		slug: post.slug,
		title: post.title,
		summary: post.summary,
		contentMd: post.markdown,
		tags: post.tags || [],
		category: post.category,
		coverUrl: post.cover,
		hidden: false,
		date: post.date || new Date().toISOString()
	})
}
