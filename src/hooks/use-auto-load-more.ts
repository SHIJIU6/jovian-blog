'use client'

import { useEffect, useRef } from 'react'

type UseAutoLoadMoreOptions = {
	hasMore: boolean
	isLoading?: boolean
	enabled?: boolean
	threshold?: number
	rootRef?: React.RefObject<HTMLElement | null>
	loadMore: () => Promise<unknown> | unknown
}

export function useAutoLoadMore({ hasMore, isLoading = false, enabled = true, threshold = 520, rootRef, loadMore }: UseAutoLoadMoreOptions) {
	const loadMoreRef = useRef(loadMore)
	const pendingRef = useRef(false)

	useEffect(() => {
		loadMoreRef.current = loadMore
	}, [loadMore])

	useEffect(() => {
		if (!enabled) return

		let frameId = 0

		const checkAndLoad = () => {
			frameId = 0
			if (!hasMore || isLoading || pendingRef.current) return

			const root = rootRef?.current
			const doc = document.documentElement
			const scrollTop = root ? root.scrollTop : window.scrollY || doc.scrollTop
			const viewportHeight = root ? root.clientHeight : window.innerHeight || doc.clientHeight
			const scrollHeight = root ? root.scrollHeight : Math.max(doc.scrollHeight, document.body.scrollHeight)

			if (scrollTop + viewportHeight < scrollHeight - threshold) return

			pendingRef.current = true
			Promise.resolve(loadMoreRef.current()).finally(() => {
				window.setTimeout(() => {
					pendingRef.current = false
				}, 120)
			})
		}

		const scheduleCheck = () => {
			if (frameId) return
			frameId = window.requestAnimationFrame(checkAndLoad)
		}

		scheduleCheck()
		const scrollTarget = rootRef?.current || window
		scrollTarget.addEventListener('scroll', scheduleCheck, { passive: true })
		window.addEventListener('resize', scheduleCheck)

		return () => {
			if (frameId) window.cancelAnimationFrame(frameId)
			scrollTarget.removeEventListener('scroll', scheduleCheck)
			window.removeEventListener('resize', scheduleCheck)
		}
	}, [enabled, hasMore, isLoading, threshold, rootRef])
}
