'use client'

import type { SiteContent } from '../../stores/config-store'

interface HatSectionProps {
	formData: SiteContent
	setFormData: React.Dispatch<React.SetStateAction<SiteContent>>
}

export function HatSection({ formData, setFormData }: HatSectionProps) {
	const currentHatIndex = formData.currentHatIndex ?? 1
	const hatCount = 24

	const handleSetHatIndex = (index: number) => {
		setFormData(prev => ({
			...prev,
			currentHatIndex: index,
			enableHat: true
		}))
	}

	return (
		<div>
			<div className='mb-3 flex items-center justify-between gap-4'>
				<div>
					<label className='block text-sm font-medium'>帽子图片</label>
					<p className='text-secondary mt-1 text-xs'>选择后会直接叠加到首页头像上，而不是作为独立卡片显示。</p>
				</div>
				<label className='flex items-center gap-2 whitespace-nowrap'>
					<input
						type='checkbox'
						checked={formData.enableHat ?? true}
						onChange={e => setFormData({ ...formData, enableHat: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>显示帽子</span>
				</label>
			</div>
			<div className='grid grid-cols-6 gap-3 max-sm:grid-cols-4'>
				{Array.from({ length: hatCount }, (_, i) => i + 1).map(index => {
					const isActive = currentHatIndex === index

					return (
						<div key={index} className='relative'>
							<button
								type='button'
								onClick={() => handleSetHatIndex(index)}
								className={`block w-full overflow-hidden rounded-xl border bg-white/60 transition-all ${
									isActive ? 'ring-brand shadow-md ring-2' : 'hover:border-brand/60'
								}`}>
								<img src={`/images/hats/${index}.webp`} alt={`hat ${index}`} className='h-20 w-full object-contain' />
							</button>
							{isActive && (
								<span className='bg-brand pointer-events-none absolute top-1 left-1 rounded-full px-2 py-0.5 text-[10px] text-white shadow'>当前使用</span>
							)}
						</div>
					)
				})}
			</div>
			<div className='mt-3'>
				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={formData.hatFlipped ?? false}
						onChange={e => setFormData({ ...formData, hatFlipped: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>左右翻转</span>
				</label>
			</div>
			<div className='mt-4 grid gap-3 md:grid-cols-3'>
				<label className='space-y-2'>
					<span className='block text-sm font-medium'>左右偏移</span>
					<input
						type='number'
						value={formData.hatOffsetX ?? 0}
						onChange={e => setFormData({ ...formData, hatOffsetX: Number(e.target.value) || 0 })}
						className='bg-card block w-full rounded-xl border px-3 py-2 text-sm'
					/>
				</label>
				<label className='space-y-2'>
					<span className='block text-sm font-medium'>上下偏移</span>
					<input
						type='number'
						value={formData.hatOffsetY ?? -10}
						onChange={e => setFormData({ ...formData, hatOffsetY: Number(e.target.value) || 0 })}
						className='bg-card block w-full rounded-xl border px-3 py-2 text-sm'
					/>
				</label>
				<label className='space-y-2'>
					<span className='block text-sm font-medium'>缩放比例</span>
					<input
						type='number'
						step='0.05'
						min='0.4'
						max='1.5'
						value={formData.hatScale ?? 0.9}
						onChange={e => {
							const value = Number(e.target.value)
							setFormData({
								...formData,
								hatScale: Number.isFinite(value) && value > 0 ? value : 0.9
							})
						}}
						className='bg-card block w-full rounded-xl border px-3 py-2 text-sm'
					/>
				</label>
			</div>
		</div>
	)
}
