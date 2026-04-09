import type { ImageItem } from '../../projects/components/image-upload-dialog'
import { Picture } from '../page'

export type PushPicturesParams = {
	pictures: Picture[]
	imageItems?: Map<string, ImageItem>
}

async function uploadAsset(file: File, folder: string) {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('folder', folder)

	const response = await fetch('/api/admin/assets/upload', {
		method: 'POST',
		body: formData
	})

	if (!response.ok) throw new Error('上传图片失败')
	return response.json() as Promise<{ url: string }>
}

export async function pushPictures(params: PushPicturesParams): Promise<void> {
	const { pictures, imageItems } = params

	let updatedPictures = [...pictures]

	if (imageItems && imageItems.size > 0) {
		for (const [key, imageItem] of imageItems.entries()) {
			if (imageItem.type === 'file') {
				const uploaded = await uploadAsset(imageItem.file, 'pictures')

				const [groupId, indexStr] = key.split('::')
				const imageIndex = Number(indexStr) || 0

				updatedPictures = updatedPictures.map(p => {
					if (p.id !== groupId) return p

					const currentImages = p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : []

					const nextImages = currentImages.map((img, idx) => (idx === imageIndex ? uploaded.url : img))

					return {
						...p,
						image: undefined,
						images: nextImages
					}
				})
			}
		}
	}

	const response = await fetch('/api/admin/pictures', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ pictures: updatedPictures })
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '保存失败')
	}
}
