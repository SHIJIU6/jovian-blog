'use client'

import { motion } from 'motion/react'
import LikeButton from './like-button'

type PageLikeButtonProps = {
	pageKey: string
}

export default function PageLikeButton({ pageKey }: PageLikeButtonProps) {
	return (
		<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='fixed right-6 bottom-6 z-20 max-sm:right-4 max-sm:bottom-4'>
			<LikeButton target={pageKey} targetType='page' delay={0} />
		</motion.div>
	)
}
