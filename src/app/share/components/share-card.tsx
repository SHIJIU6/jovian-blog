'use client'

import { motion } from 'motion/react'
import StarRating from '@/components/star-rating'
import { useSize } from '@/hooks/use-size'
import { cn } from '@/lib/utils'
import EditableStarRating from '@/components/editable-star-rating'
import { useState } from 'react'
import LogoUploadDialog, { type LogoItem } from './logo-upload-dialog'
import { ItemLikeButton } from '@/components/item-like-button'
import { LikeCountBadge } from '@/components/like-count-badge'
import type { LikeState } from '@/lib/like-types'

export interface Share {
	id: string
	name: string
	logo: string
	url: string
	description: string
	tags: string[]
	stars: number
}

interface ShareCardProps {
	share: Share
	isEditMode?: boolean
	onUpdate?: (share: Share, oldShare: Share, logoItem?: LogoItem) => void
	onDelete?: () => void
	likeTargetKey?: string
	likeState?: LikeState
	onLikeStateChange?: (state: LikeState) => void
	readOnlyLike?: boolean
}

export function ShareCard({
	share,
	isEditMode = false,
	onUpdate,
	onDelete,
	likeTargetKey,
	likeState,
	onLikeStateChange,
	readOnlyLike = false
}: ShareCardProps) {
	const [expanded, setExpanded] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const { maxSM } = useSize()
	const [localShare, setLocalShare] = useState(share)
	const [showLogoDialog, setShowLogoDialog] = useState(false)
	const [logoItem, setLogoItem] = useState<LogoItem | null>(null)

	const handleFieldChange = (field: keyof Share, value: any) => {
		const updated = { ...localShare, [field]: value }
		setLocalShare(updated)
		onUpdate?.(updated, share, logoItem || undefined)
	}

	const handleLogoSubmit = (logo: LogoItem) => {
		setLogoItem(logo)
		const logoUrl = logo.type === 'url' ? logo.url : logo.previewUrl
		const updated = { ...localShare, logo: logoUrl }
		setLocalShare(updated)
		onUpdate?.(updated, share, logo)
	}

	const handleTagsChange = (tagsStr: string) => {
		const tags = tagsStr
			.split(',')
			.map(t => t.trim())
			.filter(t => t)
		handleFieldChange('tags', tags)
	}

	const handleCancel = () => {
		setLocalShare(share)
		setIsEditing(false)
		setLogoItem(null)
	}

	const canEdit = isEditMode && isEditing

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.6 }}
			{...(maxSM ? { animate: { opacity: 1, scale: 1 } } : { whileInView: { opacity: 1, scale: 1 } })}
			className='card relative block overflow-hidden'>
			{isEditMode && (
				<div className='absolute top-3 right-3 z-10 flex gap-2'>
					{isEditing ? (
						<>
							<button onClick={handleCancel} className='text-secondary hover:text-primary rounded-lg px-2 py-1.5 text-xs transition-colors'>
								取消
							</button>
							<button onClick={() => setIsEditing(false)} className='rounded-lg px-2 py-1.5 text-xs text-blue-400 transition-colors hover:text-blue-600'>
								完成
							</button>
						</>
					) : (
						<>
							<button onClick={() => setIsEditing(true)} className='rounded-lg px-2 py-1.5 text-xs text-blue-400 transition-colors hover:text-blue-600'>
								编辑
							</button>
							<button onClick={onDelete} className='rounded-lg px-2 py-1.5 text-xs text-red-400 transition-colors hover:text-red-600'>
								删除
							</button>
						</>
					)}
				</div>
			)}

			<div>
				<div className='mb-4 flex items-center gap-4'>
					<div className='group relative'>
						{localShare.logo ? (
							<img
								src={localShare.logo}
								alt={localShare.name || '资源图标'}
								className={cn('h-16 w-16 rounded-xl object-cover', canEdit && 'cursor-pointer')}
								onClick={() => canEdit && setShowLogoDialog(true)}
							/>
						) : (
							<button type='button' onClick={() => canEdit && setShowLogoDialog(true)} className={cn('flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--surface-soft-strong)] text-xs text-secondary', canEdit && 'cursor-pointer')}>
								图标
							</button>
						)}
						{canEdit && (
							<div className='ev pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
								<span className='text-xs text-white'>更换</span>
							</div>
						)}
					</div>
					<div className='flex-1'>
						<h3
							contentEditable={canEdit}
							suppressContentEditableWarning
							onBlur={e => handleFieldChange('name', e.currentTarget.textContent || '')}
							className={cn('group-hover:text-brand text-lg font-bold transition-colors focus:outline-none', canEdit && 'cursor-text')}>
							{localShare.name}
						</h3>
						{canEdit ? (
							<div
								contentEditable
								suppressContentEditableWarning
								onBlur={e => handleFieldChange('url', e.currentTarget.textContent || '')}
								className='text-secondary mt-1 block max-w-[200px] cursor-text truncate text-xs focus:outline-none'>
								{localShare.url}
							</div>
						) : (
							<a
								href={localShare.url}
								target='_blank'
								rel='noopener noreferrer'
								className='text-secondary hover:text-brand mt-1 block max-w-[200px] truncate text-xs hover:underline'>
								{localShare.url}
							</a>
						)}
					</div>
				</div>

				{canEdit ? (
					<EditableStarRating stars={localShare.stars} editable={true} onChange={stars => handleFieldChange('stars', stars)} />
				) : (
					<StarRating stars={localShare.stars} />
				)}

				<div className='mt-3 flex flex-wrap gap-1.5'>
					{canEdit ? (
						<input
							type='text'
							value={localShare.tags.join(', ')}
							onChange={e => handleTagsChange(e.target.value)}
							placeholder='标签，用逗号分隔'
							className='surface-input w-full px-2 py-1 text-xs'
						/>
					) : (
						localShare.tags.map(tag => (
							<span key={tag} className='surface-chip px-2.5 py-0.5'>
								{tag}
							</span>
						))
					)}
				</div>

				<p
					contentEditable={canEdit}
					suppressContentEditableWarning
					onBlur={e => handleFieldChange('description', e.currentTarget.textContent || '')}
					onClick={e => {
						if (!canEdit) {
							e.preventDefault()
							setExpanded(!expanded)
						}
					}}
					className={cn(
						'text-secondary mt-3 text-sm leading-relaxed transition-all duration-300 focus:outline-none',
						canEdit ? 'cursor-text' : 'cursor-pointer',
						!canEdit && (expanded ? 'line-clamp-none' : 'line-clamp-3')
					)}>
					{localShare.description}
				</p>

				{likeTargetKey && (
					<div className='mt-4 flex items-center justify-between gap-3'>
						<div className='text-secondary text-xs'>{localShare.tags.length > 0 ? `${localShare.tags.length} 个标签` : '未设置标签'}</div>
						{readOnlyLike ? (
							<LikeCountBadge count={likeState?.count ?? 0} likedToday={likeState?.likedToday} />
						) : (
							<ItemLikeButton targetKey={likeTargetKey} state={likeState} onStateChange={onLikeStateChange} />
						)}
					</div>
				)}
			</div>

			{canEdit && showLogoDialog && <LogoUploadDialog currentLogo={localShare.logo} onClose={() => setShowLogoDialog(false)} onSubmit={handleLogoSubmit} />}
		</motion.div>
	)
}
