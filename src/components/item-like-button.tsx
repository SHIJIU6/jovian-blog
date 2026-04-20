'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { EMPTY_LIKE_STATE, type LikeState } from '@/lib/like-types'

type ItemLikeButtonProps = {
	targetKey: string
	state?: LikeState
	onStateChange?: (state: LikeState) => void
	className?: string
}

const ENDPOINT = process.env.NEXT_PUBLIC_LIKE_ENDPOINT || '/api/likes'

export function ItemLikeButton({ targetKey, state, onStateChange, className }: ItemLikeButtonProps) {
	const initialState = useMemo(() => state || EMPTY_LIKE_STATE, [state])
	const [localState, setLocalState] = useState<LikeState>(initialState)
	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		setLocalState(initialState)
	}, [initialState])

	const liked = localState.likedToday

	const handleLike = async (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault()
		event.stopPropagation()

		if (!targetKey || submitting) return
		if (!ENDPOINT) {
			toast.info('请先配置点赞接口')
			return
		}
		if (liked) {
			toast('谢谢啦😘，今天已经不能再点赞啦💕')
			return
		}

		const optimisticState = {
			count: localState.count + 1,
			likedToday: true
		}

		setSubmitting(true)
		setLocalState(optimisticState)
		onStateChange?.(optimisticState)

		try {
			const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(targetKey)}`, {
				method: 'POST'
			})
			const payload = await response.json().catch(() => ({}))
			const nextState = {
				count: typeof payload?.count === 'number' ? payload.count : optimisticState.count,
				likedToday: Boolean(payload?.likedToday ?? true)
			}
			setLocalState(nextState)
			onStateChange?.(nextState)

			if (payload?.reason === 'rate_limited') {
				toast('谢谢啦😘，今天已经不能再点赞啦💕')
			}
		} catch {
			setLocalState(initialState)
			onStateChange?.(initialState)
			toast.error('点赞失败，请稍后重试')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<button
			type='button'
			onClick={handleLike}
			disabled={liked || submitting}
			aria-pressed={liked}
			className={clsx(
				'danger-chip inline-flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-90',
				className
			)}>
			<Heart className={clsx('h-3.5 w-3.5', liked ? 'fill-current' : 'fill-transparent')} />
			<span className='tabular-nums'>{localState.count}</span>
		</button>
	)
}
