import { mkdir, access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function ensureNextTypegenArtifacts(root = process.cwd()) {
	const typesDir = path.join(root, '.next', 'types')
	const cacheLifePath = path.join(typesDir, 'cache-life.d.ts')

	await mkdir(typesDir, { recursive: true })

	let exists = true
	try {
		await access(cacheLifePath)
	} catch {
		exists = false
	}

	if (!exists) {
		await writeFile(cacheLifePath, 'export {}\n', 'utf8')
		await access(cacheLifePath)
	}

	return cacheLifePath
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await ensureNextTypegenArtifacts()
}
