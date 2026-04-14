'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { EMPTY_LIKE_STATE, type LikeState, type LikeStateMap } from '@/lib/like-types'

async function fetchLikeStateMap(keys: string[]) {
	const response = await fetch('/api/likes/batch', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ keys }),
		cache: 'no-store'
	})

	if (!response.ok) {
		throw new Error('Failed to fetch likes')
	}

	return (await response.json().catch(() => ({}))) as LikeStateMap
}

export function useBatchLikes(targetKeys: string[]) {
	const keys = useMemo(() => Array.from(new Set(targetKeys.map(key => key.trim()).filter(Boolean))), [targetKeys])
	const serializedKeys = keys.join('\n')

	const { data, error, isLoading, mutate } = useSWR(serializedKeys ? ['/api/likes/batch', serializedKeys] : null, () => fetchLikeStateMap(keys), {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	const stateByKey = data || {}

	return {
		stateByKey,
		error,
		isLoading,
		getLikeState: (targetKey: string): LikeState => stateByKey[targetKey] || EMPTY_LIKE_STATE,
		updateLikeState: (targetKey: string, nextState: LikeState) =>
			mutate(current => ({ ...(current || {}), [targetKey]: nextState }), {
				revalidate: false
			})
	}
}
