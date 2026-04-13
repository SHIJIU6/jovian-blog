import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getProjectRoot } from './project-root'
import { ensureLocalContentLayout, getLocalContentPath } from './local-content'

const SEED_ASSETS_DIR = path.join(getProjectRoot(), 'seeds', 'assets')
const LOCAL_MEDIA_DIR = getLocalContentPath('media')

function getContentType(filePath: string) {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case '.png':
			return 'image/png'
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg'
		case '.webp':
			return 'image/webp'
		case '.svg':
			return 'image/svg+xml'
		case '.gif':
			return 'image/gif'
		case '.ico':
			return 'image/x-icon'
		case '.mp3':
			return 'audio/mpeg'
		case '.m4a':
			return 'audio/mp4'
		case '.json':
			return filePath.endsWith('manifest.json') ? 'application/manifest+json' : 'application/json'
		default:
			return 'application/octet-stream'
	}
}

function sanitizeKey(key: string) {
	return key
		.split('/')
		.map(segment => segment.trim())
		.filter(Boolean)
		.filter(segment => segment !== '.' && segment !== '..')
		.join('/')
}

export async function readLocalMedia(key: string) {
	await ensureLocalContentLayout()
	const safeKey = sanitizeKey(key)
	if (!safeKey) return null

	for (const root of [LOCAL_MEDIA_DIR, SEED_ASSETS_DIR]) {
		const filePath = path.join(root, ...safeKey.split('/'))
		try {
			const buffer = await fs.readFile(filePath)
			return {
				buffer,
				contentType: getContentType(filePath)
			}
		} catch {
			// Try the next fallback.
		}
	}

	return null
}
