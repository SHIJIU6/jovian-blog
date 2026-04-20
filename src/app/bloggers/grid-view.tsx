'use client'

import { useState } from 'react'

import { type AvatarItem } from './components/avatar-upload-dialog'
import { BloggerCard } from './components/blogger-card'
import { buildLikeTargetKey } from '@/lib/like-target'
import type { LikeState } from '@/lib/like-types'

export type BloggerStatus = 'recent' | 'disconnected'

export interface Blogger {
	id: string
	name: string
	avatar: string
	url: string
	description: string
	stars: number
	status?: BloggerStatus
}

interface GridViewProps {
	bloggers: Blogger[]
	isEditMode?: boolean
	onUpdate?: (blogger: Blogger, oldBlogger: Blogger, avatarItem?: AvatarItem) => void
	onDelete?: (blogger: Blogger) => void
	getLikeState?: (targetKey: string) => LikeState
	onLikeStateChange?: (targetKey: string, nextState: LikeState) => void
	readOnlyLike?: boolean
}

export default function GridView({ bloggers, isEditMode = false, onUpdate, onDelete, getLikeState, onLikeStateChange, readOnlyLike = false }: GridViewProps) {
	const [searchTerm, setSearchTerm] = useState('')
	const [selectedCategory, setSelectedCategory] = useState<BloggerStatus>('recent')

	const filteredBloggers = bloggers.filter(blogger => {
		const status = blogger.status ?? 'recent'
		const matchesCategory = status === selectedCategory
		const matchesSearch =
			blogger.name.toLowerCase().includes(searchTerm.toLowerCase()) || blogger.description.toLowerCase().includes(searchTerm.toLowerCase())
		return matchesCategory && matchesSearch
	})

	return (
		<div className='mx-auto w-full max-w-7xl px-6 pt-24 pb-12'>
			<div className='mb-8 space-y-4'>
				<input
					type='text'
					placeholder='搜索博主...'
					value={searchTerm}
					onChange={e => setSearchTerm(e.target.value)}
					className='surface-input mx-auto block w-full max-w-md px-4 py-2'
				/>

				<div className='flex flex-wrap justify-center gap-2'>
					<button
						onClick={() => setSelectedCategory('recent')}
						className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
							selectedCategory === 'recent' ? 'bg-brand text-white' : 'bg-[var(--surface-soft-strong)] text-secondary hover:bg-[var(--surface-hover)]'
						}`}>
						近期更新
					</button>
					<button
						onClick={() => setSelectedCategory('disconnected')}
						className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
							selectedCategory === 'disconnected' ? 'bg-brand text-white' : 'bg-[var(--surface-soft-strong)] text-secondary hover:bg-[var(--surface-hover)]'
						}`}>
						长期失联
					</button>
				</div>
			</div>

			<div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
				{filteredBloggers.map(blogger => {
					const likeTargetKey = buildLikeTargetKey(blogger.id, 'blogger')
					return (
						<BloggerCard
							key={blogger.id}
							blogger={blogger}
							isEditMode={isEditMode}
							onUpdate={onUpdate}
							onDelete={() => onDelete?.(blogger)}
							likeTargetKey={likeTargetKey}
							likeState={getLikeState?.(likeTargetKey)}
							onLikeStateChange={nextState => onLikeStateChange?.(likeTargetKey, nextState)}
							readOnlyLike={readOnlyLike}
						/>
					)
				})}
			</div>

			{filteredBloggers.length === 0 && (
				<div className='text-secondary mt-12 text-center'>
					<p>没有找到相关博主</p>
				</div>
			)}
		</div>
	)
}
