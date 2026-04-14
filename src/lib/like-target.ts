import { BLOG_SLUG_KEY } from '@/consts'

export type LikeTargetType = 'page' | 'post' | 'project' | 'share' | 'blogger' | 'picture' | 'snippet' | 'site'

export function buildLikeTargetKey(target: string, targetType: LikeTargetType = 'post') {
	const normalizedTarget = target.trim()
	if (!normalizedTarget) return ''

	return `${BLOG_SLUG_KEY}${targetType}:${normalizedTarget}`
}

export function buildPictureLikeTarget(pictureId: string, imageIndex: number | string) {
	const normalizedPictureId = pictureId.trim()
	if (!normalizedPictureId) return ''
	return `${normalizedPictureId}:${String(imageIndex).trim()}`
}
