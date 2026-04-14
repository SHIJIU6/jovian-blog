import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getContentBindings } from './content/cloudflare'
import { getProjectRoot } from './project-root'
import { getLocalContentPath } from './local-content'

const PUBLIC_MUSIC_DIR = path.join(getProjectRoot(), 'public', 'music')
const LOCAL_MUSIC_DIR = getLocalContentPath('media', 'music')
const MUSIC_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg'])

export type MusicTrack = {
	name: string
	url: string
	source: 'env' | 'public' | 'local' | 'r2'
}

function isSupportedMusicFile(fileName: string) {
	return MUSIC_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

function normalizeTrackName(fileName: string) {
	return path.basename(fileName)
}

function buildPublicMusicUrl(fileName: string) {
	return `/music/${encodeURIComponent(normalizeTrackName(fileName))}`
}

function buildManagedMusicUrl(fileName: string) {
	return `/api/media/music/${encodeURIComponent(normalizeTrackName(fileName))}`
}

function parseConfiguredTracks() {
	const raw = process.env.NEXT_PUBLIC_SAMPLE_AUDIO || ''
	return raw
		.split(/[\n,]/)
		.map(item => item.trim())
		.filter(Boolean)
		.map(url => {
			const pathname = url.split('?')[0] || url
			const fileName = decodeURIComponent(path.basename(pathname))
			return {
				name: fileName,
				url,
				source: 'env' as const
			}
		})
}

async function listTracksFromDirectory(dirPath: string, mapUrl: (fileName: string) => string, source: MusicTrack['source']) {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })
		return entries
			.filter(entry => entry.isFile() && isSupportedMusicFile(entry.name))
			.map(entry => ({
				name: entry.name,
				url: mapUrl(entry.name),
				source
			}))
	} catch {
		return []
	}
}

async function listTracksFromR2() {
	try {
		const env = await getContentBindings()
		if (!env?.BLOG_MEDIA || typeof env.BLOG_MEDIA.list !== 'function') {
			return []
		}

		const result = await env.BLOG_MEDIA.list({ prefix: 'music/' })
		const objects = Array.isArray(result?.objects) ? result.objects : []
		return objects
			.map((object: { key?: string }) => object?.key || '')
			.filter((key: string) => key.startsWith('music/'))
			.filter((key: string) => isSupportedMusicFile(key))
			.map((key: string) => ({
				name: normalizeTrackName(key),
				url: `/api/media/${key.split('/').map((segment: string) => encodeURIComponent(segment)).join('/')}`,
				source: 'r2' as const
			}))
	} catch {
		return []
	}
}

export async function listMusicTracks(): Promise<MusicTrack[]> {
	const [publicTracks, localTracks, r2Tracks] = await Promise.all([
		listTracksFromDirectory(PUBLIC_MUSIC_DIR, buildPublicMusicUrl, 'public'),
		listTracksFromDirectory(LOCAL_MUSIC_DIR, buildManagedMusicUrl, 'local'),
		listTracksFromR2()
	])

	const deduped = new Map<string, MusicTrack>()

	for (const track of [...parseConfiguredTracks(), ...publicTracks, ...localTracks, ...r2Tracks]) {
		const key = track.url.toLowerCase()
		if (!deduped.has(key)) {
			deduped.set(key, track)
		}
	}

	return Array.from(deduped.values())
}
