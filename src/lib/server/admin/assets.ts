import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getContentBindings } from '../content/cloudflare'
import { ensureLocalContentDir, getLocalContentPath } from '../local-content'

const LOCAL_MEDIA_DIR = getLocalContentPath('media')

function sanitizeSegment(value: string) {
	return value
		.split('/')
		.map(segment => segment.trim())
		.filter(Boolean)
		.filter(segment => segment !== '.' && segment !== '..')
		.map(segment => segment.replace(/[^a-zA-Z0-9._-]/g, '-'))
		.join('/')
}

async function hashBuffer(buffer: ArrayBuffer) {
	const digest = await crypto.subtle.digest('SHA-256', buffer)
	return Array.from(new Uint8Array(digest))
		.map(byte => byte.toString(16).padStart(2, '0'))
		.join('')
}

async function ensureDir(target: string) {
	await ensureLocalContentDir(target)
}

export async function saveAsset(file: File, folder = 'misc', exactKey?: string) {
	const env = await getContentBindings()
	const buffer = await file.arrayBuffer()
	const hash = await hashBuffer(buffer)
	const extension = path.extname(file.name) || ''
	const normalizedFolder = sanitizeSegment(folder).replace(/^\/+|\/+$/g, '')
	const fileName = `${hash}${extension}`
	const resolvedKey = exactKey ? sanitizeSegment(exactKey).replace(/^\/+/, '') : `${normalizedFolder}/${fileName}`
	const assetId = crypto.randomUUID()

	if (env?.BLOG_MEDIA) {
		await env.BLOG_MEDIA.put(resolvedKey, buffer, {
			httpMetadata: {
				contentType: file.type || 'application/octet-stream'
			}
		})

		if (env.BLOG_DB) {
			try {
				await env.BLOG_DB.prepare(
					`INSERT INTO assets (id, r2_key, filename, mime_type, size, source, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT(r2_key) DO UPDATE SET
					 	filename = excluded.filename,
					 	mime_type = excluded.mime_type,
					 	size = excluded.size,
					 	source = excluded.source`
				)
					.bind(assetId, resolvedKey, file.name, file.type || 'application/octet-stream', file.size, normalizedFolder || 'misc', new Date().toISOString())
					.run()
			} catch {
				// Keep uploads available even when the metadata table is not ready yet.
			}
		}

		return {
			id: assetId,
			key: resolvedKey,
			url: `/api/media/${resolvedKey}`,
			filename: fileName,
			contentType: file.type || 'application/octet-stream',
			size: file.size
		}
	}

	const relativeDir = exactKey ? path.dirname(resolvedKey) : path.join('uploads', normalizedFolder)
	const absoluteDir = path.join(LOCAL_MEDIA_DIR, relativeDir)
	await ensureDir(absoluteDir)
	const relativePath = exactKey ? `/${resolvedKey.replace(/\\/g, '/')}` : path.posix.join('/uploads', normalizedFolder, fileName)
	const fileTarget = exactKey ? path.basename(resolvedKey) : fileName
	await fs.writeFile(path.join(absoluteDir, fileTarget), Buffer.from(buffer))

	return {
		id: assetId,
		key: relativePath.replace(/^\//, ''),
		url: `/api/media/${relativePath.replace(/^\//, '')}`,
		filename: fileName,
		contentType: file.type || 'application/octet-stream',
		size: file.size
	}
}
