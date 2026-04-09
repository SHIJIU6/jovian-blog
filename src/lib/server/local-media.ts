import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getProjectRoot } from './project-root'

const PUBLIC_DIR = path.join(getProjectRoot(), 'public')

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
	const safeKey = sanitizeKey(key)
	if (!safeKey) return null

	const filePath = path.join(PUBLIC_DIR, ...safeKey.split('/'))
	try {
		const buffer = await fs.readFile(filePath)
		return {
			buffer,
			contentType: getContentType(filePath)
		}
	} catch {
		return null
	}
}
