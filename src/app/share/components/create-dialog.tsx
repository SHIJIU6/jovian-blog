'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import LogoUploadDialog, { type LogoItem } from './logo-upload-dialog'
import type { Share } from './share-card'
import { DialogModal } from '@/components/dialog-modal'
import { createContentItemId } from '@/lib/content-item-id'

interface CreateDialogProps {
	share: Share | null
	onClose: () => void
	onSave: (share: Share, logoItem?: LogoItem) => void
}

export default function CreateDialog({ share, onClose, onSave }: CreateDialogProps) {
	const [formData, setFormData] = useState<Share>({
		id: createContentItemId('share'),
		name: '',
		logo: '',
		url: '',
		description: '',
		tags: [],
		stars: 3
	})
	const [showLogoDialog, setShowLogoDialog] = useState(false)
	const [selectedLogoItem, setSelectedLogoItem] = useState<LogoItem | undefined>()
	const [tagsInput, setTagsInput] = useState('')

	useEffect(() => {
		if (share) {
			setFormData(share)
			setTagsInput(share.tags.join(', '))
		} else {
			setFormData({
				id: createContentItemId('share'),
				name: '',
				logo: '',
				url: '',
				description: '',
				tags: [],
				stars: 3
			})
			setTagsInput('')
		}
		setSelectedLogoItem(undefined)
	}, [share])

	const handleLogoSubmit = (logo: LogoItem) => {
		const logoUrl = logo.type === 'url' ? logo.url : logo.previewUrl
		setSelectedLogoItem(logo)
		setFormData({ ...formData, logo: logoUrl })
	}

	const handleTagsChange = (value: string) => {
		setTagsInput(value)
		const tags = value
			.split(',')
			.map(t => t.trim())
			.filter(t => t)
		setFormData({ ...formData, tags })
	}

	const handleSubmit = () => {
		onSave(formData, selectedLogoItem)
		onClose()
		toast.success(share ? '更新成功' : '添加成功')
	}

	return (
		<DialogModal open onClose={onClose} className='card max-h-[90vh] w-sm overflow-y-auto'>
			{/* 卡片样式的内容 */}
			<div>
				<div className='mb-4 flex items-center gap-4'>
					<div className='group relative cursor-pointer' onClick={() => setShowLogoDialog(true)}>
						{formData.logo ? (
							<>
								<img src={formData.logo} alt={formData.name} className='h-16 w-16 rounded-xl object-cover' />
								<div className='pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
									<span className='text-xs text-white'>更换</span>
								</div>
							</>
						) : (
							<div className='flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--surface-soft-strong)]'>
								<Plus className='text-secondary h-6 w-6' />
							</div>
						)}
					</div>
					<div className='flex-1'>
						<input
							type='text'
							value={formData.name}
							onChange={e => setFormData({ ...formData, name: e.target.value })}
							placeholder='资源名称'
							className='w-full text-lg font-bold focus:outline-none'
						/>
						<input
							type='text'
							value={formData.url}
							onChange={e => setFormData({ ...formData, url: e.target.value })}
							placeholder='https://example.com'
							className='text-secondary mt-1 w-full truncate text-xs focus:outline-none'
						/>
					</div>
				</div>

				{/* 星级评分 */}
				<div className='flex items-center gap-0.5'>
					{[1, 2, 3, 4, 5].map(index => (
						<div key={index} onClick={() => setFormData({ ...formData, stars: index })} className='cursor-pointer'>
							<svg width='16' height='16' viewBox='0 0 24 24' className={index <= formData.stars ? 'fill-yellow-400' : 'fill-gray-300'}>
								<path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
							</svg>
						</div>
					))}
				</div>

				{/* 标签输入 */}
				<div className='mt-3'>
					<input
						type='text'
						value={tagsInput}
						onChange={e => handleTagsChange(e.target.value)}
						placeholder='标签，用逗号分隔（如：图片, 工具）'
						className='surface-input w-full px-3 py-2'
					/>
					<div className='mt-2 flex flex-wrap gap-1.5'>
						{formData.tags.map(tag => (
							<span key={tag} className='surface-chip px-2.5 py-0.5'>
								{tag}
							</span>
						))}
					</div>
				</div>

				<textarea
					value={formData.description}
					onChange={e => setFormData({ ...formData, description: e.target.value })}
					placeholder='资源介绍...'
					className='mt-3 w-full resize-none text-sm leading-relaxed focus:outline-none'
					rows={4}
				/>
			</div>

			{/* 操作按钮 */}
			<div className='mt-6 flex gap-3'>
				<button onClick={onClose} className='surface-btn flex-1 px-4'>
					取消
				</button>
				<button onClick={handleSubmit} className='brand-btn flex-1 justify-center px-4'>
					{share ? '保存' : '添加'}
				</button>
			</div>

			{showLogoDialog && <LogoUploadDialog currentLogo={formData.logo} onClose={() => setShowLogoDialog(false)} onSubmit={handleLogoSubmit} />}
		</DialogModal>
	)
}
