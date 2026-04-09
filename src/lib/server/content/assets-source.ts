import type { CategoriesConfig } from '@/hooks/use-categories'
import type { ContentBindings, ContentListOptions, ContentPostDetail, ContentPostListItem } from './types'

const INTERNAL_ORIGIN = 'https://internal.content'

async function fetchAssetJson<T>(env: ContentBindings, pathname: string, fallback: T): Promise<T> {
	try {
		const response = await env.ASSETS?.fetch(new Request(new URL(pathname, INTERNAL_ORIGIN)))
		if (!response?.ok) return fallback
		return (await response.json()) as T
	} catch {
		return fallback
	}
}

async function fetchAssetText(env: ContentBindings, pathname: string): Promise<string | null> {
	try {
		const response = await env.ASSETS?.fetch(new Request(new URL(pathname, INTERNAL_ORIGIN)))
		if (!response?.ok) return null
		return response.text()
	} catch {
		return null
	}
}

export async function listPostsFromAssets(env: ContentBindings, options: ContentListOptions = {}): Promise<ContentPostListItem[]> {
	const items = await fetchAssetJson<ContentPostListItem[]>(env, '/blogs/index.json', [])
	const filtered = options.includeHidden ? items : items.filter(item => !item.hidden)
	const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	return typeof options.limit === 'number' ? sorted.slice(0, options.limit) : sorted
}

export async function getPostFromAssets(env: ContentBindings, slug: string, options: ContentListOptions = {}): Promise<ContentPostDetail | null> {
	const posts = await listPostsFromAssets(env, { includeHidden: true })
	const summaryItem = posts.find(item => item.slug === slug)
	if (!summaryItem) return null
	if (!options.includeHidden && summaryItem.hidden) return null

	const config = await fetchAssetJson<Record<string, unknown>>(env, `/blogs/${slug}/config.json`, {})
	const markdown = await fetchAssetText(env, `/blogs/${slug}/index.md`)
	if (!markdown) return null

	return {
		...summaryItem,
		title: (config.title as string) || summaryItem.title,
		summary: (config.summary as string) || summaryItem.summary,
		tags: Array.isArray(config.tags) ? (config.tags as string[]) : summaryItem.tags,
		date: (config.date as string) || summaryItem.date,
		cover: (config.cover as string) || summaryItem.cover,
		category: (config.category as string) || summaryItem.category,
		hidden: typeof config.hidden === 'boolean' ? (config.hidden as boolean) : summaryItem.hidden,
		markdown
	}
}

export async function getCategoriesFromAssets(env: ContentBindings): Promise<CategoriesConfig> {
	return fetchAssetJson<CategoriesConfig>(env, '/blogs/categories.json', { categories: [] })
}
