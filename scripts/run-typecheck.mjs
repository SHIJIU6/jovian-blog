import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { ensureNextTypegenArtifacts } from './ensure-next-typegen-artifacts.mjs'
import { resolveLocalBin, runLocalCommand } from './run-local-command.mjs'

const ROOT = process.cwd()
const TYPES_DIR = path.join(ROOT, '.next', 'types')

async function snapshotDir(dirPath) {
	const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => [])
	const parts = await Promise.all(
		entries.map(async entry => {
			const fullPath = path.join(dirPath, entry.name)
			const entryStat = await stat(fullPath).catch(() => null)
			return `${entry.name}:${entryStat?.mtimeMs || 0}:${entryStat?.size || 0}`
		})
	)
	return parts.sort().join('|')
}

async function waitForTypesDirToSettle(maxChecks = 20, intervalMs = 150) {
	let previous = ''
	let stableRounds = 0

	for (let index = 0; index < maxChecks; index += 1) {
		const current = await snapshotDir(TYPES_DIR)
		if (current && current === previous) {
			stableRounds += 1
			if (stableRounds >= 3) return
		} else {
			stableRounds = 0
			previous = current
		}
		await new Promise(resolve => setTimeout(resolve, intervalMs))
	}
}

async function ensureArtifactsAreStable(attempts = 8, intervalMs = 200) {
	for (let index = 0; index < attempts; index += 1) {
		await ensureNextTypegenArtifacts(ROOT)
		await new Promise(resolve => setTimeout(resolve, intervalMs))
		try {
			await stat(path.join(TYPES_DIR, 'cache-life.d.ts'))
			return
		} catch {
			// Continue retrying until the directory stops deleting the placeholder.
		}
	}

	await ensureNextTypegenArtifacts(ROOT)
}

runLocalCommand('node', ['scripts/generate-music-manifest.mjs'])
runLocalCommand(resolveLocalBin('next'), ['typegen'])
await waitForTypesDirToSettle()
await ensureArtifactsAreStable()
runLocalCommand(resolveLocalBin('tsc'), ['--noEmit', '--incremental', 'false'])
