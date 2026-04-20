'use client'

import { ANIMATION_DELAY } from '@/consts'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useSize } from '@/hooks/use-size'
import { useCenterStore } from '@/hooks/use-center'

interface Props {
	className?: string
	order: number
	width: number
	height?: number
	x: number
	y: number
	children: React.ReactNode
}

export default function Card({ children, order, width, height, x, y, className }: Props) {
	const { maxSM, init } = useSize()
	const viewportWidth = useCenterStore(state => state.width)
	let [show, setShow] = useState(false)
	if (maxSM && init) order = 0
	const resolvedWidth = maxSM && viewportWidth > 0 ? Math.min(width, Math.max(viewportWidth - 24, 0)) : width

	useEffect(() => {
		if (show) return
		if (x === 0 && y === 0) return
		setTimeout(
			() => {
				setShow(true)
			},
			order * ANIMATION_DELAY * 1000
		)
	}, [x, y, show])

	if (show)
		return (
			<motion.div
				className={cn('card squircle min-w-0 max-w-full', className)}
				initial={{ opacity: 0, scale: 0.6, left: x, top: y, width: resolvedWidth, height }}
				animate={{ opacity: 1, scale: 1, left: x, top: y, width: resolvedWidth, height }}>
				{children}
			</motion.div>
		)

	return null
}
