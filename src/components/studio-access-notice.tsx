'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

interface StudioAccessNoticeProps {
	title?: string
	description?: string
	target?: string
}

export function StudioAccessNotice({
	title = '内容管理已迁移到后台',
	description = '公共前台现在只负责展示内容。请进入轻量后台继续创建、编辑、发布和维护站点内容。',
	target = '/studio'
}: StudioAccessNoticeProps) {
	return (
		<div className='flex min-h-[70vh] items-center justify-center px-6 py-24'>
			<div className='bg-card w-full max-w-2xl space-y-5 rounded-[32px] border p-8 text-center shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
				<h1 className='text-2xl font-semibold'>{title}</h1>
				<p className='text-secondary leading-7'>{description}</p>
				<div className='flex justify-center'>
					<motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
						<Link href={target} className='brand-btn inline-flex items-center gap-2 px-6'>
							进入后台
						</Link>
					</motion.div>
				</div>
			</div>
		</div>
	)
}
