import { mkdir, access, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const typesDir = path.join(ROOT, '.next', 'types')
const cacheLifePath = path.join(typesDir, 'cache-life.d.ts')

try {
	await access(cacheLifePath)
} catch {
	await mkdir(typesDir, { recursive: true })
	await writeFile(cacheLifePath, 'export {}\n', 'utf8')
}
