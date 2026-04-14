import { BLOG_SLUG_KEY } from '@/consts'

export type LikeTargetType = 'page' | 'post' | 'resource' | 'site'

export function buildLikeTargetKey(target: string, targetType: LikeTargetType = 'post') {
	const normalizedTarget = target.trim()
	if (!normalizedTarget) return ''

	return `${BLOG_SLUG_KEY}${targetType}:${normalizedTarget}`
}
