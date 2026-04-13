import path from 'node:path'
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { getProjectRoot } from './project-root'

const ROOT = getProjectRoot()
const LOCAL_CONTENT_ROOT = path.join(ROOT, '.local-content')
const LEGACY_FILE_MIGRATIONS = [
	[getLocalContentPath('src', 'config', 'site-content.json'), getLocalContentPath('content', 'site-content.json')],
	[getLocalContentPath('src', 'config', 'card-styles.json'), getLocalContentPath('content', 'card-styles.json')],
	[getLocalContentPath('src', 'app', 'about', 'list.json'), getLocalContentPath('content', 'about.json')],
	[getLocalContentPath('src', 'app', 'projects', 'list.json'), getLocalContentPath('content', 'projects.json')],
	[getLocalContentPath('src', 'app', 'share', 'list.json'), getLocalContentPath('content', 'shares.json')],
	[getLocalContentPath('src', 'app', 'bloggers', 'list.json'), getLocalContentPath('content', 'bloggers.json')],
	[getLocalContentPath('src', 'app', 'snippets', 'list.json'), getLocalContentPath('content', 'snippets.json')],
	[getLocalContentPath('src', 'app', 'pictures', 'list.json'), getLocalContentPath('content', 'pictures.json')],
	[getLocalContentPath('public', 'favicon.png'), getLocalContentPath('media', 'favicon.png')],
	[getLocalContentPath('public', 'manifest.json'), getLocalContentPath('media', 'manifest.json')]
] as const
const LEGACY_DIRECTORY_MIGRATIONS = [
	[getLocalContentPath('public', 'blogs'), getLocalContentPath('content', 'blogs')],
	[getLocalContentPath('public', 'uploads'), getLocalContentPath('media', 'uploads')],
	[getLocalContentPath('public', 'images'), getLocalContentPath('media', 'images')],
	[getLocalContentPath('public', 'music'), getLocalContentPath('media', 'music')]
] as const

let migrationPromise: Promise<void> | null = null

export function getLocalContentPath(...segments: string[]) {
	return path.join(LOCAL_CONTENT_ROOT, ...segments)
}

export function resolveContentReadPath(fallbackPath: string, ...candidatePaths: string[]) {
	for (const candidatePath of candidatePaths) {
		if (candidatePath && existsSync(candidatePath)) {
			return candidatePath
		}
	}

	return fallbackPath
}

export async function ensureLocalContentDir(targetPath: string) {
	const normalizedTarget = path.extname(targetPath) ? path.dirname(targetPath) : targetPath
	await fs.mkdir(normalizedTarget, { recursive: true })
}

async function pathExists(targetPath: string) {
	try {
		await fs.access(targetPath)
		return true
	} catch {
		return false
	}
}

async function ensureParentDir(targetPath: string) {
	await fs.mkdir(path.dirname(targetPath), { recursive: true })
}

async function moveFileIfNeeded(sourcePath: string, targetPath: string) {
	if (!(await pathExists(sourcePath)) || (await pathExists(targetPath))) {
		return
	}

	await ensureParentDir(targetPath)
	await fs.rename(sourcePath, targetPath)
}

async function mergeDirectory(sourceDir: string, targetDir: string): Promise<void> {
	if (!(await pathExists(sourceDir))) {
		return
	}

	if (!(await pathExists(targetDir))) {
		await ensureParentDir(targetDir)
		await fs.rename(sourceDir, targetDir)
		return
	}

	const entries = await fs.readdir(sourceDir, { withFileTypes: true })
	for (const entry of entries) {
		const sourcePath = path.join(sourceDir, entry.name)
		const targetPath = path.join(targetDir, entry.name)

		if (entry.isDirectory()) {
			await mergeDirectory(sourcePath, targetPath)
			continue
		}

		if (!(await pathExists(targetPath))) {
			await ensureParentDir(targetPath)
			await fs.rename(sourcePath, targetPath)
		}
	}

	const remainingEntries = await fs.readdir(sourceDir)
	if (remainingEntries.length === 0) {
		await fs.rmdir(sourceDir)
	}
}

async function migrateLegacyLocalContent() {
	for (const [sourcePath, targetPath] of LEGACY_FILE_MIGRATIONS) {
		await moveFileIfNeeded(sourcePath, targetPath)
	}

	for (const [sourceDir, targetDir] of LEGACY_DIRECTORY_MIGRATIONS) {
		await mergeDirectory(sourceDir, targetDir)
	}
}

export async function ensureLocalContentLayout() {
	if (!migrationPromise) {
		migrationPromise = migrateLegacyLocalContent().catch(error => {
			migrationPromise = null
			throw error
		})
	}

	await migrationPromise
}
