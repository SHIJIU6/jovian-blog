import { normalizeBlogStatus } from '@/lib/blog-status'
import type { ImageItem } from '../types'
import { formatDateTimeLocal } from '../stores/write-store'

export type PushBlogParams = {
	form: {
		slug: string
		title: string
		md: string
		tags: string[]
		date?: string
		summary?: string
		hidden?: boolean
		category?: string
		status?: string
	}
	cover?: ImageItem | null
	images?: ImageItem[]
	mode?: 'create' | 'edit'
	originalSlug?: string | null
}

async function uploadAsset(file: File, folder: string) {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('folder', folder)

	const response = await fetch('/api/admin/assets/upload', {
		method: 'POST',
		body: formData
	})

	if (!response.ok) {
		throw new Error('上传图片失败')
	}

	return response.json() as Promise<{ url: string }>
}

function normalizePostSlug(value: string, fallback: string) {
	const raw = (value || fallback).trim()
	const normalized = raw
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return normalized || `post-${Date.now()}`
}

export async function pushBlog(params: PushBlogParams): Promise<void> {
	const { form, cover, images, mode = 'create', originalSlug } = params
	const status = normalizeBlogStatus(form.status, form.hidden)
	const slug = normalizePostSlug(form.slug, form.title)

	if (mode === 'edit' && originalSlug && originalSlug !== slug) {
		throw new Error('编辑模式下不支持修改 slug，请保持原 slug 不变')
	}

	let markdown = form.md
	let coverUrl: string | undefined = cover?.type === 'url' ? cover.url : undefined

	const uploaded = new Map<string, string>()
	for (const image of images || []) {
		if (image.type !== 'file') continue
		const result = await uploadAsset(image.file, `posts/${slug}`)
		uploaded.set(image.id, result.url)
	}

	if (cover?.type === 'file') {
		const result = await uploadAsset(cover.file, `posts/${slug}`)
		coverUrl = result.url
		uploaded.set(cover.id, result.url)
	}

	for (const [id, url] of uploaded.entries()) {
		const placeholder = `local-image:${id}`
		markdown = markdown.split(`(${placeholder})`).join(`(${url})`)
	}

	const response = await fetch('/api/admin/posts', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			slug,
			title: form.title || '未命名文章',
			summary: form.summary,
			contentMd: markdown,
			tags: form.tags,
			category: form.category,
			coverUrl,
			hidden: status !== 'published',
			status,
			date: form.date || formatDateTimeLocal()
		})
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '保存文章失败')
	}
}
