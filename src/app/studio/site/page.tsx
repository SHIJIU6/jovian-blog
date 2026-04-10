'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { useConfigStore, type CardStyles, type SiteContent } from '@/app/(home)/stores/config-store'
import { pushSiteContent } from '@/app/(home)/services/push-site-content'
import { SiteSettings, type FileItem, type ArtImageUploads, type BackgroundImageUploads, type SocialButtonImageUploads } from '@/app/(home)/config-dialog/site-settings'
import { ColorConfig } from '@/app/(home)/config-dialog/color-config'
import { HomeLayout } from '@/app/(home)/config-dialog/home-layout'
import { useSiteConfigContent } from '@/hooks/use-structured-content'

type TabType = 'site' | 'color' | 'layout'

const tabs: { id: TabType; label: string; description: string }[] = [
	{ id: 'site', label: '站点设置', description: '标题、头像、社交链接、背景、插画等基础配置。' },
	{ id: 'color', label: '色彩配置', description: '主题色、背景色与预设配色。' },
	{ id: 'layout', label: '首页布局', description: '首页卡片开关、尺寸与偏移，以及拖拽布局入口。' }
]

export default function StudioSitePage() {
	const { data } = useSiteConfigContent()
	const { setSiteContent, setCardStyles, regenerateBubbles } = useConfigStore()
	const [activeTab, setActiveTab] = useState<TabType>('site')
	const [formData, setFormData] = useState<SiteContent | null>(null)
	const [cardStylesData, setCardStylesData] = useState<CardStyles | null>(null)
	const [originalData, setOriginalData] = useState<SiteContent | null>(null)
	const [originalCardStyles, setOriginalCardStyles] = useState<CardStyles | null>(null)
	const [isSaving, setIsSaving] = useState(false)
	const [faviconItem, setFaviconItem] = useState<FileItem | null>(null)
	const [avatarItem, setAvatarItem] = useState<FileItem | null>(null)
	const [artImageUploads, setArtImageUploads] = useState<ArtImageUploads>({})
	const [backgroundImageUploads, setBackgroundImageUploads] = useState<BackgroundImageUploads>({})
	const [socialButtonImageUploads, setSocialButtonImageUploads] = useState<SocialButtonImageUploads>({})

	useEffect(() => {
		if (!data) return
		setFormData(data.siteContent)
		setCardStylesData(data.cardStyles)
		setOriginalData(data.siteContent)
		setOriginalCardStyles(data.cardStyles)
		setSiteContent(data.siteContent)
		setCardStyles(data.cardStyles)
	}, [data, setCardStyles, setSiteContent])

	const cleanupUploads = () => {
		if (faviconItem?.type === 'file') URL.revokeObjectURL(faviconItem.previewUrl)
		if (avatarItem?.type === 'file') URL.revokeObjectURL(avatarItem.previewUrl)
		Object.values(artImageUploads).forEach(item => item.type === 'file' && URL.revokeObjectURL(item.previewUrl))
		Object.values(backgroundImageUploads).forEach(item => item.type === 'file' && URL.revokeObjectURL(item.previewUrl))
		Object.values(socialButtonImageUploads).forEach(item => item.type === 'file' && URL.revokeObjectURL(item.previewUrl))
	}

	const updateThemeVariables = (theme?: SiteContent['theme']) => {
		if (typeof document === 'undefined' || !theme) return
		const root = document.documentElement
		root.style.setProperty('--color-brand', theme.colorBrand)
		root.style.setProperty('--color-primary', theme.colorPrimary)
		root.style.setProperty('--color-secondary', theme.colorSecondary)
		root.style.setProperty('--color-brand-secondary', theme.colorBrandSecondary)
		root.style.setProperty('--color-bg', theme.colorBg)
		root.style.setProperty('--color-border', theme.colorBorder)
		root.style.setProperty('--color-card', theme.colorCard)
		root.style.setProperty('--color-article', theme.colorArticle)
	}

	const handlePreview = () => {
		if (!formData || !cardStylesData) return
		setSiteContent(formData)
		setCardStyles(cardStylesData)
		regenerateBubbles()
		updateThemeVariables(formData.theme)
		toast.success('预览已应用到当前会话')
	}

	const handleReset = () => {
		if (!originalData || !originalCardStyles) return
		cleanupUploads()
		setFormData(originalData)
		setCardStylesData(originalCardStyles)
		setFaviconItem(null)
		setAvatarItem(null)
		setArtImageUploads({})
		setBackgroundImageUploads({})
		setSocialButtonImageUploads({})
		setSiteContent(originalData)
		setCardStyles(originalCardStyles)
		regenerateBubbles()
		updateThemeVariables(originalData.theme)
		toast.info('已恢复为当前线上配置')
	}

	const handleSave = async () => {
		if (!formData || !cardStylesData || !originalData) return
		setIsSaving(true)
		try {
			const removedArtImages = (originalData.artImages ?? []).filter(orig => !(formData.artImages ?? []).some(current => current.id === orig.id))
			const removedBackgroundImages = (originalData.backgroundImages ?? []).filter(
				orig => !(formData.backgroundImages ?? []).some(current => current.id === orig.id)
			)

			const savedSiteContent = await pushSiteContent(
				formData,
				cardStylesData,
				faviconItem,
				avatarItem,
				artImageUploads,
				removedArtImages,
				backgroundImageUploads,
				removedBackgroundImages,
				socialButtonImageUploads
			)

			setFormData(savedSiteContent)
			setOriginalData(savedSiteContent)
			setOriginalCardStyles(cardStylesData)
			setSiteContent(savedSiteContent)
			setCardStyles(cardStylesData)
			updateThemeVariables(savedSiteContent.theme)
			cleanupUploads()
			setFaviconItem(null)
			setAvatarItem(null)
			setArtImageUploads({})
			setBackgroundImageUploads({})
			setSocialButtonImageUploads({})
			toast.success('站点配置已保存')
		} catch (error: any) {
			toast.error(error?.message || '保存失败')
		} finally {
			setIsSaving(false)
		}
	}

	const currentTab = useMemo(() => tabs.find(tab => tab.id === activeTab), [activeTab])

	if (!formData || !cardStylesData) {
		return (
			<div className='bg-card rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
				<div className='text-secondary text-sm'>正在加载站点配置...</div>
			</div>
		)
	}

	const updateFormData: React.Dispatch<React.SetStateAction<SiteContent>> = nextValue => {
		setFormData(prevValue => {
			const currentValue = prevValue ?? formData
			return typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
		})
	}

	const updateCardStylesData: React.Dispatch<React.SetStateAction<CardStyles>> = nextValue => {
		setCardStylesData(prevValue => {
			const currentValue = prevValue ?? cardStylesData
			return typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
		})
	}

	return (
		<div className='space-y-6'>
			<section className='bg-card rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
				<div className='flex items-start justify-between gap-6 max-md:flex-col'>
					<div className='space-y-3'>
						<p className='text-secondary text-xs uppercase tracking-[0.24em]'>Site Studio</p>
						<h2 className='text-2xl font-semibold'>站点配置工作区</h2>
						<p className='text-secondary max-w-3xl leading-7'>
							这里是终局方案中的后台配置页，不再依赖前台弹窗。你可以统一调整站点信息、配色、首页布局与资源素材。
						</p>
					</div>
					<div className='flex flex-wrap gap-3'>
						<motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={handlePreview} className='bg-card rounded-xl border px-5 py-2.5 text-sm'>
							预览
						</motion.button>
						<motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={handleReset} className='bg-card rounded-xl border px-5 py-2.5 text-sm'>
							恢复
						</motion.button>
						<motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => void handleSave()} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : '保存'}
						</motion.button>
					</div>
				</div>
			</section>

			<section className='grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]'>
				<aside className='bg-card h-fit rounded-[28px] border p-4 shadow-[0_24px_36px_-28px_rgba(0,0,0,0.08)] backdrop-blur'>
					<nav className='space-y-2'>
						{tabs.map(tab => (
							<button
								key={tab.id}
								type='button'
								onClick={() => setActiveTab(tab.id)}
								className={`flex w-full items-center rounded-2xl px-3 py-2.5 text-left text-sm transition-all ${
									activeTab === tab.id
										? 'border bg-[linear-gradient(to_right_bottom,var(--color-border)_60%,var(--color-card)_100%)] text-primary font-medium'
										: 'text-secondary hover:bg-white/40'
								}`}>
								{tab.label}
							</button>
						))}
					</nav>
				</aside>

				<div className='bg-card space-y-6 rounded-[28px] border p-6 shadow-[0_24px_36px_-28px_rgba(0,0,0,0.08)] backdrop-blur'>
					<div className='space-y-2'>
						<h3 className='text-xl font-semibold'>{currentTab?.label}</h3>
						<p className='text-secondary text-sm leading-7'>{currentTab?.description}</p>
					</div>

					{activeTab === 'site' && (
						<SiteSettings
							formData={formData}
							setFormData={updateFormData}
							faviconItem={faviconItem}
							setFaviconItem={setFaviconItem}
							avatarItem={avatarItem}
							setAvatarItem={setAvatarItem}
							artImageUploads={artImageUploads}
							setArtImageUploads={setArtImageUploads}
							backgroundImageUploads={backgroundImageUploads}
							setBackgroundImageUploads={setBackgroundImageUploads}
							socialButtonImageUploads={socialButtonImageUploads}
							setSocialButtonImageUploads={setSocialButtonImageUploads}
						/>
					)}
					{activeTab === 'color' && <ColorConfig formData={formData} setFormData={updateFormData} />}
					{activeTab === 'layout' && <HomeLayout cardStylesData={cardStylesData} setCardStylesData={updateCardStylesData} />}
				</div>
			</section>
		</div>
	)
}
