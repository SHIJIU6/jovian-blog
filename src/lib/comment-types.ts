export const COMMENT_TARGET_TYPES = ['post', 'project', 'share', 'blogger', 'picture', 'snippet', 'site'] as const

export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number]

export type CommentStatus = 'pending' | 'approved' | 'spam' | 'deleted'

export type CommentItem = {
	id: string
	targetType: CommentTargetType
	targetId: string
	parentId?: string
	authorName: string
	authorEmail?: string
	authorUrl?: string
	content: string
	status: CommentStatus
	ipHash?: string
	userAgentHash?: string
	createdAt: string
	updatedAt: string
}

export type CommentCreateInput = {
	targetType: CommentTargetType
	targetId: string
	parentId?: string
	authorName?: string
	authorEmail?: string
	email?: string
	authorUrl?: string
	content: string
}

export function isCommentTargetType(value: string): value is CommentTargetType {
	return (COMMENT_TARGET_TYPES as readonly string[]).includes(value)
}
