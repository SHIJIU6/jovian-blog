import type { Share } from '../components/share-card'
import type { LogoItem } from '../components/logo-upload-dialog'

export type PushSharesParams = {
	shares: Share[]
	logoItems?: Map<string, LogoItem>
}

async function uploadAsset(file: File, folder: string) {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('folder', folder)

	const response = await fetch('/api/admin/assets/upload', {
		method: 'POST',
		body: formData
	})

	if (!response.ok) throw new Error('上传图标失败')
	return response.json() as Promise<{ url: string }>
}

export async function pushShares(params: PushSharesParams): Promise<void> {
	const { shares, logoItems } = params
	let nextShares = [...shares]

	if (logoItems?.size) {
		for (const [url, logoItem] of logoItems.entries()) {
			if (logoItem.type !== 'file') continue
			const uploaded = await uploadAsset(logoItem.file, 'shares')
			nextShares = nextShares.map(share => (share.url === url ? { ...share, logo: uploaded.url } : share))
		}
	}

	const response = await fetch('/api/admin/shares', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ shares: nextShares })
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '保存失败')
	}
}
