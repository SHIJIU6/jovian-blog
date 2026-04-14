'use client'

import clsx from 'clsx'
import { Heart } from 'lucide-react'

type LikeCountBadgeProps = {
	count: number
	likedToday?: boolean
	className?: string
	soft?: boolean
}

export function LikeCountBadge({ count, likedToday = false, className, soft = false }: LikeCountBadgeProps) {
	return (
		<span
			className={clsx(
				'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums',
				soft ? 'border-white/50 bg-white/55 text-gray-700 backdrop-blur' : 'border-rose-200 bg-rose-50 text-rose-600',
				className
			)}>
			<Heart className={clsx('h-3.5 w-3.5', likedToday ? 'fill-current' : 'fill-transparent')} />
			<span>{count}</span>
		</span>
	)
}
