import { toast } from 'sonner'
import type { SiteContent, CardStyles } from '../stores/config-store'
import type { FileItem, ArtImageUploads, SocialButtonImageUploads, BackgroundImageUploads } from '../config-dialog/site-settings'

type ArtImageConfig = SiteContent['artImages'][number]
type BackgroundImageConfig = SiteContent['backgroundImages'][number]

function withVersion(url: string) {
	const separator = url.includes('?') ? '&' : '?'
	return `${url}${separator}v=${Date.now()}`
}

async function uploadAsset(file: File, folder: string, key?: string) {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('folder', folder)
	if (key) formData.append('key', key)

	const response = await fetch('/api/admin/assets/upload', {
		method: 'POST',
		body: formData
	})

	if (!response.ok) {
		throw new Error('上传资源失败')
	}

	return response.json() as Promise<{ url: string }>
}

export async function pushSiteContent(
	siteContent: SiteContent,
	cardStyles: CardStyles,
	faviconItem?: FileItem | null,
	avatarItem?: FileItem | null,
	artImageUploads?: ArtImageUploads,
	removedArtImages?: ArtImageConfig[],
	backgroundImageUploads?: BackgroundImageUploads,
	removedBackgroundImages?: BackgroundImageConfig[],
	socialButtonImageUploads?: SocialButtonImageUploads
): Promise<SiteContent> {
	const nextSiteContent: SiteContent = JSON.parse(JSON.stringify(siteContent))

	if (faviconItem?.type === 'file') {
		toast.info('正在上传 Favicon...')
		await uploadAsset(faviconItem.file, 'site', 'favicon.png')
		nextSiteContent.faviconUrl = withVersion('/api/media/favicon.png')
	}

	if (avatarItem?.type === 'file') {
		toast.info('正在上传 Avatar...')
		await uploadAsset(avatarItem.file, 'site', 'images/avatar.png')
		nextSiteContent.avatarUrl = withVersion('/api/media/images/avatar.png')
	}

	if (artImageUploads) {
		for (const [id, item] of Object.entries(artImageUploads)) {
			if (item.type !== 'file') continue
			toast.info(`正在上传 Art 图片 ${id}...`)
			const uploaded = await uploadAsset(item.file, 'site/art')
			nextSiteContent.artImages = (nextSiteContent.artImages || []).map(art => (art.id === id ? { ...art, url: uploaded.url } : art))
		}
	}

	if (removedArtImages?.length) {
		const removedIds = new Set(removedArtImages.map(item => item.id))
		nextSiteContent.artImages = (nextSiteContent.artImages || []).filter(item => !removedIds.has(item.id))
		if (removedIds.has(nextSiteContent.currentArtImageId || '')) {
			nextSiteContent.currentArtImageId = nextSiteContent.artImages?.[0]?.id || ''
		}
	}

	if (backgroundImageUploads) {
		for (const [id, item] of Object.entries(backgroundImageUploads)) {
			if (item.type !== 'file') continue
			toast.info(`正在上传背景图片 ${id}...`)
			const uploaded = await uploadAsset(item.file, 'site/backgrounds')
			nextSiteContent.backgroundImages = (nextSiteContent.backgroundImages || []).map(bg => (bg.id === id ? { ...bg, url: uploaded.url } : bg))
		}
	}

	if (removedBackgroundImages?.length) {
		const removedIds = new Set(removedBackgroundImages.map(item => item.id))
		nextSiteContent.backgroundImages = (nextSiteContent.backgroundImages || []).filter(item => !removedIds.has(item.id))
		if (removedIds.has(nextSiteContent.currentBackgroundImageId || '')) {
			nextSiteContent.currentBackgroundImageId = nextSiteContent.backgroundImages?.[0]?.id || ''
		}
	}

	if (socialButtonImageUploads) {
		for (const [buttonId, item] of Object.entries(socialButtonImageUploads)) {
			if (item.type !== 'file') continue
			toast.info(`正在上传社交按钮图片 ${buttonId}...`)
			const uploaded = await uploadAsset(item.file, 'site/social')
			nextSiteContent.socialButtons = (nextSiteContent.socialButtons || []).map(button => (button.id === buttonId ? { ...button, value: uploaded.url } : button))
		}
	}

	const response = await fetch('/api/admin/site-config', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ siteContent: nextSiteContent, cardStyles })
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '保存失败')
	}

	toast.success('保存成功！')
	return nextSiteContent
}
