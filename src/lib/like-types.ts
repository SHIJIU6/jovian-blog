export type LikeState = {
	count: number
	likedToday: boolean
}

export type LikeStateMap = Record<string, LikeState>

export const EMPTY_LIKE_STATE: LikeState = {
	count: 0,
	likedToday: false
}
