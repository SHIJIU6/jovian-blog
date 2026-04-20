'use client'

import { useState } from 'react'

import { type LogoItem } from './components/logo-upload-dialog'
import { ShareCard, type Share } from './components/share-card'
import { buildLikeTargetKey } from '@/lib/like-target'
import type { LikeState } from '@/lib/like-types'

interface GridViewProps {
	shares: Share[]
	isEditMode?: boolean
	onUpdate?: (share: Share, oldShare: Share, logoItem?: LogoItem) => void
	onDelete?: (share: Share) => void
	getLikeState?: (targetKey: string) => LikeState
	onLikeStateChange?: (targetKey: string, nextState: LikeState) => void
	readOnlyLike?: boolean
}

export default function GridView({ shares, isEditMode = false, onUpdate, onDelete, getLikeState, onLikeStateChange, readOnlyLike = false }: GridViewProps) {
	const [searchTerm, setSearchTerm] = useState('')
	const [selectedTag, setSelectedTag] = useState<string>('all')

	const allTags = Array.from(new Set(shares.flatMap(share => share.tags)))

	const filteredShares = shares.filter(share => {
		const matchesSearch = share.name.toLowerCase().includes(searchTerm.toLowerCase()) || share.description.toLowerCase().includes(searchTerm.toLowerCase())
		const matchesTag = selectedTag === 'all' || share.tags.includes(selectedTag)
		return matchesSearch && matchesTag
	})

	return (
		<div className='mx-auto w-full max-w-7xl px-6 pt-24 pb-12'>
			<div className='mb-8 space-y-4'>
				<input
					type='text'
					placeholder='搜索资源...'
					value={searchTerm}
					onChange={e => setSearchTerm(e.target.value)}
					className='surface-input mx-auto block w-full max-w-md px-4 py-2'
				/>

				<div className='flex flex-wrap justify-center gap-2'>
					<button
						onClick={() => setSelectedTag('all')}
						className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
							selectedTag === 'all' ? 'bg-brand text-white' : 'bg-[var(--surface-soft-strong)] text-secondary hover:bg-[var(--surface-hover)]'
						}`}>
						全部
					</button>
					{allTags.map(tag => (
						<button
							key={tag}
							onClick={() => setSelectedTag(tag)}
							className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
								selectedTag === tag ? 'bg-brand text-white' : 'bg-[var(--surface-soft-strong)] text-secondary hover:bg-[var(--surface-hover)]'
							}`}>
							{tag}
						</button>
					))}
				</div>
			</div>

			<div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
				{filteredShares.map(share => {
					const likeTargetKey = buildLikeTargetKey(share.id, 'share')
					return (
						<ShareCard
							key={share.id}
							share={share}
							isEditMode={isEditMode}
							onUpdate={onUpdate}
							onDelete={() => onDelete?.(share)}
							likeTargetKey={likeTargetKey}
							likeState={getLikeState?.(likeTargetKey)}
							onLikeStateChange={nextState => onLikeStateChange?.(likeTargetKey, nextState)}
							readOnlyLike={readOnlyLike}
						/>
					)
				})}
			</div>

			{filteredShares.length === 0 && (
				<div className='text-secondary mt-12 text-center'>
					<p>没有找到相关资源</p>
				</div>
			)}
		</div>
	)
}
