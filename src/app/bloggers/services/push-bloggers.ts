import type { Blogger } from '../grid-view'
import type { AvatarItem } from '../components/avatar-upload-dialog'

export type PushBloggersParams = {
	bloggers: Blogger[]
	avatarItems?: Map<string, AvatarItem>
}

async function uploadAsset(file: File, folder: string) {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('folder', folder)

	const response = await fetch('/api/admin/assets/upload', {
		method: 'POST',
		body: formData
	})

	if (!response.ok) throw new Error('上传头像失败')
	return response.json() as Promise<{ url: string }>
}

export async function pushBloggers(params: PushBloggersParams): Promise<void> {
	const { bloggers, avatarItems } = params
	let nextBloggers = [...bloggers]

	if (avatarItems?.size) {
		for (const [bloggerId, avatarItem] of avatarItems.entries()) {
			if (avatarItem.type !== 'file') continue
			const uploaded = await uploadAsset(avatarItem.file, 'bloggers')
			nextBloggers = nextBloggers.map(blogger => (blogger.id === bloggerId ? { ...blogger, avatar: uploaded.url } : blogger))
		}
	}

	const response = await fetch('/api/admin/bloggers', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ bloggers: nextBloggers })
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '保存失败')
	}
}
