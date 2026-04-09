import type { BlogConfig } from '@/app/blog/types'

export type { BlogConfig } from '@/app/blog/types'

export type LoadedBlog = {
	slug: string
	config: BlogConfig
	markdown: string
	cover?: string
}

type LoadBlogOptions = {
	includeHidden?: boolean
}

/**
 * Load blog data from the content API.
 * Used by both view page and studio edit page.
 */
export async function loadBlog(slug: string, options: LoadBlogOptions = {}): Promise<LoadedBlog> {
	if (!slug) {
		throw new Error('Slug is required')
	}

	const search = options.includeHidden ? '?includeHidden=true' : ''
	const response = await fetch(`/api/content/posts/${encodeURIComponent(slug)}${search}`, { cache: 'no-store' })
	if (!response.ok) {
		throw new Error('Blog not found')
	}
	const payload = (await response.json()) as {
		title?: string
		tags?: string[]
		date?: string
		summary?: string
		cover?: string
		hidden?: boolean
		category?: string
		markdown?: string
	}

	return {
		slug,
		config: {
			title: payload.title,
			tags: payload.tags,
			date: payload.date,
			summary: payload.summary,
			cover: payload.cover,
			hidden: payload.hidden,
			category: payload.category
		},
		markdown: payload.markdown || '',
		cover: payload.cover
	}
}
