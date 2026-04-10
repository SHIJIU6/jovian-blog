import path from 'node:path'
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { getProjectRoot } from './project-root'

const ROOT = getProjectRoot()
const LOCAL_CONTENT_ROOT = path.join(ROOT, '.local-content')

export function getLocalContentPath(...segments: string[]) {
	return path.join(LOCAL_CONTENT_ROOT, ...segments)
}

export function resolveContentReadPath(templatePath: string, localPath: string) {
	return existsSync(localPath) ? localPath : templatePath
}

export async function ensureLocalContentDir(targetPath: string) {
	const normalizedTarget = path.extname(targetPath) ? path.dirname(targetPath) : targetPath
	await fs.mkdir(normalizedTarget, { recursive: true })
}
