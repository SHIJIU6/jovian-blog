import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getContentBindings } from './content/cloudflare'
import { getProjectRoot } from './project-root'
import { getLocalContentPath } from './local-content'
import generatedMusicManifest from '@/generated/music-manifest.json'

type GeneratedMusicManifest = {
	tracks?: unknown[]
}

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

function getTrackDisplayName(fileName: string) {
	return path.parse(normalizeTrackName(fileName)).name
}

function buildPublicMusicUrl(fileName: string) {
	return `/music/${encodeURIComponent(normalizeTrackName(fileName))}`
}

function buildManagedMusicUrl(fileName: string) {
	return `/api/media/music/${encodeURIComponent(normalizeTrackName(fileName))}`
}

function parseConfiguredTracks(knownPublicUrls: Set<string>) {
	const raw = process.env.NEXT_PUBLIC_SAMPLE_AUDIO || ''
	return raw
		.split(/[\n,]/)
		.map(item => item.trim())
		.filter(Boolean)
		.map(url => {
			const pathname = url.split('?')[0] || url
			const fileName = decodeURIComponent(path.basename(pathname))
			return {
				name: getTrackDisplayName(fileName),
				url,
				source: 'env' as const
			}
		})
		.filter(track => {
			if (!track.url.startsWith('/music/')) return true
			return knownPublicUrls.has(track.url.toLowerCase())
		})
}

async function listTracksFromDirectory(dirPath: string, mapUrl: (fileName: string) => string, source: MusicTrack['source']) {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })
		return entries
			.filter(entry => entry.isFile() && isSupportedMusicFile(entry.name))
			.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
			.map(entry => ({
				name: getTrackDisplayName(entry.name),
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
			.sort((a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN'))
			.map((key: string) => ({
				name: getTrackDisplayName(key),
				url: `/api/media/${key.split('/').map((segment: string) => encodeURIComponent(segment)).join('/')}`,
				source: 'r2' as const
			}))
	} catch {
		return []
	}
}

export async function listMusicTracks(): Promise<MusicTrack[]> {
	const manifest = generatedMusicManifest as GeneratedMusicManifest
	const generatedPublicTracks = Array.isArray(manifest.tracks)
		? manifest.tracks.filter((track): track is MusicTrack => {
				const candidate = track as Partial<MusicTrack> | null
				return Boolean(candidate && typeof candidate.name === 'string' && typeof candidate.url === 'string' && typeof candidate.source === 'string')
			})
		: []

	const [publicTracks, localTracks, r2Tracks] = await Promise.all([
		listTracksFromDirectory(PUBLIC_MUSIC_DIR, buildPublicMusicUrl, 'public'),
		listTracksFromDirectory(LOCAL_MUSIC_DIR, buildManagedMusicUrl, 'local'),
		listTracksFromR2()
	])

	const knownPublicUrls = new Set([...generatedPublicTracks, ...publicTracks].map(track => track.url.toLowerCase()))
	const deduped = new Map<string, MusicTrack>()

	for (const track of [...parseConfiguredTracks(knownPublicUrls), ...generatedPublicTracks, ...publicTracks, ...localTracks, ...r2Tracks]) {
		const key = track.url.toLowerCase()
		if (!deduped.has(key)) {
			deduped.set(key, track)
		}
	}

	return Array.from(deduped.values())
}
