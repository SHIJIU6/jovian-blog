import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { CategoriesConfig } from '@/hooks/use-categories'
import type { ContentListOptions, ContentPostDetail, ContentPostListItem } from './types'
import { getProjectRoot } from '../project-root'
import { isPublicBlogStatus, normalizeBlogStatus } from '@/lib/blog-status'

const PUBLIC_DIR = path.join(getProjectRoot(), 'public')

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
	try {
		const text = await fs.readFile(filePath, 'utf8')
		return JSON.parse(text) as T
	} catch {
		return fallback
	}
}

export async function listPostsFromFiles(options: ContentListOptions = {}): Promise<ContentPostListItem[]> {
	const items = await readJsonFile<ContentPostListItem[]>(path.join(PUBLIC_DIR, 'blogs', 'index.json'), [])
	const normalized = items.map(item => ({
		...item,
		status: normalizeBlogStatus(item.status, item.hidden),
		hidden: !isPublicBlogStatus(item.status, item.hidden)
	}))
	const filtered = options.includeHidden ? normalized : normalized.filter(item => isPublicBlogStatus(item.status, item.hidden))
	const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	return typeof options.limit === 'number' ? sorted.slice(0, options.limit) : sorted
}

export async function getPostFromFiles(slug: string, options: ContentListOptions = {}): Promise<ContentPostDetail | null> {
	const posts = await listPostsFromFiles({ includeHidden: true })
	const summaryItem = posts.find(item => item.slug === slug)
	if (!summaryItem) return null
	if (!options.includeHidden && !isPublicBlogStatus(summaryItem.status, summaryItem.hidden)) return null

	const config = await readJsonFile<Record<string, unknown>>(path.join(PUBLIC_DIR, 'blogs', slug, 'config.json'), {})
	try {
		const markdown = await fs.readFile(path.join(PUBLIC_DIR, 'blogs', slug, 'index.md'), 'utf8')
		const status = normalizeBlogStatus(typeof config.status === 'string' ? String(config.status) : summaryItem.status, typeof config.hidden === 'boolean' ? Boolean(config.hidden) : summaryItem.hidden)
		return {
			...summaryItem,
			title: (config.title as string) || summaryItem.title,
			summary: (config.summary as string) || summaryItem.summary,
			tags: Array.isArray(config.tags) ? (config.tags as string[]) : summaryItem.tags,
			date: (config.date as string) || summaryItem.date,
			cover: (config.cover as string) || summaryItem.cover,
			category: (config.category as string) || summaryItem.category,
			status,
			hidden: !isPublicBlogStatus(status),
			markdown
		}
	} catch {
		return null
	}
}

export async function getCategoriesFromFiles(): Promise<CategoriesConfig> {
	return readJsonFile<CategoriesConfig>(path.join(PUBLIC_DIR, 'blogs', 'categories.json'), { categories: [] })
}
