import path from 'node:path'
import { existsSync } from 'node:fs'

function isProjectRoot(target: string) {
	return existsSync(path.join(target, 'package.json')) && existsSync(path.join(target, 'public')) && existsSync(path.join(target, 'src'))
}

export function getProjectRoot() {
	const cwd = process.cwd()
	const direct = cwd
	if (isProjectRoot(direct)) return direct

	const nested = path.join(cwd, '2025-blog-public')
	if (isProjectRoot(nested)) return nested

	return cwd
}
