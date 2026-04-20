import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'motion/react'
import { Heart } from 'lucide-react'
import clsx from 'clsx'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { buildLikeTargetKey, type LikeTargetType } from '@/lib/like-target'

type LikeButtonProps = {
	target: string
	targetType?: LikeTargetType
	className?: string
	delay?: number
}

type LikeResponse = {
	count: number | null
	likedToday: boolean
	reason?: 'rate_limited'
}

const ENDPOINT = process.env.NEXT_PUBLIC_LIKE_ENDPOINT || '/api/likes'

export default function LikeButton({ target, targetType = 'post', delay, className }: LikeButtonProps) {
	const [liked, setLiked] = useState(false)
	const [likedToday, setLikedToday] = useState(false)
	const [show, setShow] = useState(false)
	const [justLiked, setJustLiked] = useState(false)
	const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])
	const targetKey = buildLikeTargetKey(target, targetType)

	useEffect(() => {
		const timer = setTimeout(() => {
			setShow(true)
		}, delay ?? 1000)

		return () => clearTimeout(timer)
	}, [delay])

	useEffect(() => {
		setLiked(false)
		setLikedToday(false)
		setJustLiked(false)
		setParticles([])
	}, [targetKey])

	useEffect(() => {
		if (justLiked) {
			const timer = setTimeout(() => setJustLiked(false), 600)
			return () => clearTimeout(timer)
		}
	}, [justLiked])

	const fetcher = useCallback(async (url: string): Promise<LikeResponse> => {
		const res = await fetch(url, { method: 'GET', cache: 'no-store' })
		if (!res.ok) {
			return {
				count: null,
				likedToday: false
			}
		}
		const data = await res.json().catch(() => ({}))
		return {
			count: typeof data?.count === 'number' ? data.count : null,
			likedToday: Boolean(data?.likedToday)
		}
	}, [])

	const { data: fetchedState, mutate } = useSWR(targetKey && ENDPOINT ? `${ENDPOINT}?key=${encodeURIComponent(targetKey)}` : null, fetcher, {
		revalidateOnFocus: false,
		dedupingInterval: 1000 * 10
	})

	useEffect(() => {
		if (!fetchedState?.likedToday) return
		setLiked(true)
		setLikedToday(true)
	}, [fetchedState?.likedToday])

	const handleLike = useCallback(async () => {
		if (!targetKey) return
		if (!ENDPOINT) {
			toast.info('请先配置点赞接口')
			return
		}

		if (likedToday) {
			toast('谢谢啦😘，今天已经不能再点赞啦💕')
			return
		}

		const previousLiked = liked
		const previousLikedToday = likedToday
		setLiked(true)
		setJustLiked(true)

		// Create particle effects
		const newParticles = Array.from({ length: 6 }, (_, i) => ({
			id: Date.now() + i,
			x: Math.random() * 60 - 30,
			y: Math.random() * 60 - 30
		}))
		setParticles(newParticles)

		// Clear particles after animation
		setTimeout(() => setParticles([]), 1000)

		try {
			const url = `${ENDPOINT}?key=${encodeURIComponent(targetKey)}`
			const res = await fetch(url, { method: 'POST' })
			const data = await res.json().catch(() => ({}))
			if (data.reason == 'rate_limited') {
				setLikedToday(true)
				toast('谢谢啦😘，今天已经不能再点赞啦💕')
			}

			const value = typeof data?.count === 'number' ? data.count : (fetchedState?.count ?? 0) + 1
			await mutate(
				{
					count: value,
					likedToday: Boolean(data?.likedToday ?? true),
					reason: data?.reason === 'rate_limited' ? 'rate_limited' : undefined
				},
				{ revalidate: false }
			)
			setLikedToday(Boolean(data?.likedToday ?? true))
		} catch {
			setLiked(previousLiked)
			setLikedToday(previousLikedToday)
			setJustLiked(false)
			setParticles([])
			toast.error('点赞失败，请稍后重试')
		}
	}, [targetKey, liked, likedToday, fetchedState?.count, mutate])

	const count = typeof fetchedState?.count === 'number' ? fetchedState.count : null

	if (!show || !targetKey) {
		return null
	}

	return (
		<motion.button
			initial={{ opacity: 0, scale: 0.6 }}
			animate={{ opacity: 1, scale: 1 }}
			whileHover={{ scale: 1.05 }}
			whileTap={{ scale: 0.95 }}
			aria-label='Like this item'
			onClick={handleLike}
			disabled={likedToday}
			className={clsx('card heartbeat-container relative overflow-visible rounded-full p-3', className)}>
			<AnimatePresence>
				{particles.map(particle => (
					<motion.div
						key={particle.id}
						className='pointer-events-none absolute inset-0 flex items-center justify-center'
						initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
						animate={{
							opacity: [1, 1, 0],
							scale: [0, 1.2, 0.8],
							x: particle.x,
							y: particle.y
						}}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8, ease: 'easeOut' }}>
						<Heart className='fill-rose-400 text-rose-400' size={12} />
					</motion.div>
				))}
			</AnimatePresence>

			{typeof count === 'number' && (
				<motion.span
					initial={{ scale: 0.4 }}
					animate={{ scale: 1 }}
					className={cn(
						'absolute -top-2 left-9 min-w-6 rounded-full px-1.5 py-1 text-center text-xs tabular-nums',
						liked ? 'bg-rose-400 text-white' : 'surface-chip'
					)}>
					{count}
				</motion.span>
			)}
			<motion.div animate={justLiked ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] } : {}} transition={{ duration: 0.6, ease: 'easeOut' }}>
				<Heart className={clsx('heartbeat', liked ? 'fill-rose-400 text-rose-400' : 'fill-rose-200 text-rose-200')} size={28} />
			</motion.div>
		</motion.button>
	)
}
