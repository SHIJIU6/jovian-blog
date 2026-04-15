import { spawnSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const BIN_DIR = path.join(ROOT, 'node_modules', '.bin')

function quoteCmdArg(value) {
	return /[\s"]/u.test(value) ? `"${String(value).replace(/"/g, '\\"')}"` : String(value)
}

export function resolveLocalBin(name) {
	return process.platform === 'win32' ? path.join(BIN_DIR, `${name}.cmd`) : path.join(BIN_DIR, name)
}

export function runLocalCommand(command, args = []) {
	const result =
		process.platform === 'win32'
			? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `${quoteCmdArg(command)} ${args.map(quoteCmdArg).join(' ')}`], {
					cwd: ROOT,
					stdio: 'inherit'
				})
			: spawnSync(command, args, {
					cwd: ROOT,
					stdio: 'inherit',
					shell: false
				})

	if (result.error) {
		throw result.error
	}

	if (result.status !== 0) {
		process.exit(result.status || 1)
	}
}
