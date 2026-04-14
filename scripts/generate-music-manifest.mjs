import path from 'node:path'
import { mkdir, readdir, writeFile } from 'node:fs/promises'

const ROOT = process.cwd()
const publicMusicDir = path.join(ROOT, 'public', 'music')
const outputDir = path.join(ROOT, 'src', 'generated')
const outputPath = path.join(outputDir, 'music-manifest.json')
const supportedExtensions = new Set(['.mp3', '.m4a', '.wav', '.ogg'])

function isSupportedMusicFile(fileName) {
	return supportedExtensions.has(path.extname(fileName).toLowerCase())
}

function getTrackName(fileName) {
	return path.parse(path.basename(fileName)).name
}

async function main() {
	let tracks = []

	try {
		const entries = await readdir(publicMusicDir, { withFileTypes: true })
		tracks = entries
			.filter(entry => entry.isFile() && isSupportedMusicFile(entry.name))
			.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
			.map(entry => ({
				name: getTrackName(entry.name),
				url: `/music/${encodeURIComponent(entry.name)}`,
				source: 'public'
			}))
	} catch {
		tracks = []
	}

	await mkdir(outputDir, { recursive: true })
	await writeFile(outputPath, JSON.stringify({ tracks }, null, 2) + '\n', 'utf8')
}

await main()
