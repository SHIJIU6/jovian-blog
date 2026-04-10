export type BlogStatus = 'draft' | 'published' | 'offline'

export function normalizeBlogStatus(input?: string | null, hidden?: boolean): BlogStatus {
	if (input === 'draft' || input === 'published' || input === 'offline') {
		return input
	}

	return hidden ? 'draft' : 'published'
}

export function isPublicBlogStatus(status?: string | null, hidden?: boolean) {
	return normalizeBlogStatus(status, hidden) === 'published'
}

export function getBlogStatusLabel(status?: string | null, hidden?: boolean) {
	switch (normalizeBlogStatus(status, hidden)) {
		case 'draft':
			return '草稿'
		case 'offline':
			return '已下线'
		case 'published':
		default:
			return '已发布'
	}
}
