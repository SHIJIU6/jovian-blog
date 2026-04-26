import type { Project } from '../components/project-card'
import type { ImageItem } from '../components/image-upload-dialog'

export type PushProjectsParams = {
	projects: Project[]
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

export async function pushProjects(params: PushProjectsParams): Promise<Project[]> {
	const { projects, imageItems } = params
	let nextProjects = projects.map(project => ({
		...project,
		image: project.image?.startsWith('blob:') ? '' : project.image
	}))

	if (imageItems?.size) {
		for (const [projectId, imageItem] of imageItems.entries()) {
			if (imageItem.type !== 'file') continue
			const uploaded = await uploadAsset(imageItem.file, 'projects')
			nextProjects = nextProjects.map(project => (project.id === projectId ? { ...project, image: uploaded.url } : project))
		}
	}

	const response = await fetch('/api/admin/projects', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ projects: nextProjects })
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '保存失败')
	}

	const payload = (await response.json().catch(() => ({}))) as { items?: Project[] }
	return payload.items || nextProjects
}
