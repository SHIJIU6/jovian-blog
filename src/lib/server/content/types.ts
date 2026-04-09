import type { BlogIndexItem } from '@/app/blog/types'

export type ContentPostListItem = BlogIndexItem & {
	id?: string
	status?: string
	createdAt?: string
	updatedAt?: string
	publishedAt?: string
}

export type ContentPostDetail = ContentPostListItem & {
	markdown: string
}

export type ContentListOptions = {
	includeHidden?: boolean
	limit?: number
}

export type ContentBindings = {
	BLOG_DB?: any
	BLOG_MEDIA?: any
	ASSETS?: {
		fetch: (request: Request) => Promise<Response>
	}
}
