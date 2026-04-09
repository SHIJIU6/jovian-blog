import type { Project } from '@/app/projects/components/project-card'
import type { Share } from '@/app/share/components/share-card'
import type { Blogger } from '@/app/bloggers/grid-view'
import type { Picture } from '@/app/pictures/page'

type D1Row = Record<string, unknown>

/**
 * Reference: Cloudflare D1 docs (Workers prepared statements and batch execution, retrieved via Context7 on 2026-04-09)
 * and @opennextjs/cloudflare v1.14.4 from package.json.
 * We keep table-backed structured content writes isolated here so the app can prefer D1 without losing local file fallback.
 */

function normalizeKey(...parts: Array<unknown>): string {
	return parts
		.map(part => (typeof part === 'string' ? part.trim().toLowerCase() : ''))
		.filter(Boolean)
		.join('::')
}

function parseStringArray(value: unknown): string[] {
	if (typeof value !== 'string' || value.length === 0) return []
	try {
		const parsed = JSON.parse(value) as unknown
		return Array.isArray(parsed) ? parsed.map(item => String(item)).filter(Boolean) : []
	} catch {
		return []
	}
}

function getString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getExistingMetaMap(rows: D1Row[], keyFactory: (row: D1Row) => string) {
	const map = new Map<string, { id: string; createdAt: string }>()
	for (const row of rows) {
		const id = getString(row.id)
		const createdAt = getString(row.created_at)
		const key = keyFactory(row)
		if (!id || !createdAt || !key || map.has(key)) continue
		map.set(key, { id, createdAt })
	}
	return map
}

async function getAllRows(db: any, query: string, ...params: unknown[]) {
	const result = await db.prepare(query).bind(...params).all()
	return Array.isArray(result?.results) ? (result.results as D1Row[]) : []
}

async function runBatch(db: any, statements: any[]) {
	if (typeof db.batch === 'function') {
		await db.batch(statements)
		return
	}

	for (const statement of statements) {
		await statement.run()
	}
}

export async function getProjectsFromD1(db: any): Promise<Project[] | null> {
	try {
		const rows = await getAllRows(
			db,
			'SELECT name, year, description, image_url, url, tags_json, github_url, npm_url FROM projects ORDER BY sort_order ASC, updated_at DESC, created_at DESC'
		)

		return rows.map(row => ({
			name: String(row.name || ''),
			year: getNumber(row.year) || 0,
			description: String(row.description || ''),
			image: getString(row.image_url) || '',
			url: String(row.url || ''),
			tags: parseStringArray(row.tags_json),
			github: getString(row.github_url),
			npm: getString(row.npm_url)
		}))
	} catch {
		return null
	}
}

export async function saveProjectsToD1(db: any, items: Project[]): Promise<boolean> {
	try {
		const rows = await getAllRows(db, 'SELECT id, url, name, created_at FROM projects')
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.url, row.name))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM projects')]

		items.forEach((project, index) => {
			const key = normalizeKey(project.url, project.name)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare(
						`INSERT INTO projects (
							id, name, description, year, image_url, url, github_url, npm_url, tags_json, sort_order, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						meta?.id || crypto.randomUUID(),
						project.name,
						project.description || null,
						project.year || null,
						project.image || null,
						project.url,
						project.github || null,
						project.npm || null,
						JSON.stringify(project.tags || []),
						index,
						meta?.createdAt || now,
						now
					)
			)
		})

		await runBatch(db, statements)
		return true
	} catch {
		return false
	}
}

export async function getSharesFromD1(db: any): Promise<Share[] | null> {
	try {
		const rows = await getAllRows(
			db,
			'SELECT name, logo_url, url, description, tags_json, stars FROM resources ORDER BY sort_order ASC, updated_at DESC, created_at DESC'
		)

		return rows.map(row => ({
			name: String(row.name || ''),
			logo: getString(row.logo_url) || '',
			url: String(row.url || ''),
			description: String(row.description || ''),
			tags: parseStringArray(row.tags_json),
			stars: getNumber(row.stars) || 0
		}))
	} catch {
		return null
	}
}

export async function saveSharesToD1(db: any, items: Share[]): Promise<boolean> {
	try {
		const rows = await getAllRows(db, 'SELECT id, url, name, created_at FROM resources')
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.url, row.name))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM resources')]

		items.forEach((share, index) => {
			const key = normalizeKey(share.url, share.name)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare(
						`INSERT INTO resources (
							id, name, description, url, logo_url, stars, tags_json, sort_order, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						meta?.id || crypto.randomUUID(),
						share.name,
						share.description || null,
						share.url,
						share.logo || null,
						share.stars || 0,
						JSON.stringify(share.tags || []),
						index,
						meta?.createdAt || now,
						now
					)
			)
		})

		await runBatch(db, statements)
		return true
	} catch {
		return false
	}
}

export async function getBloggersFromD1(db: any): Promise<Blogger[] | null> {
	try {
		const rows = await getAllRows(
			db,
			'SELECT name, avatar_url, url, description, stars, status FROM bloggers ORDER BY sort_order ASC, updated_at DESC, created_at DESC'
		)

		return rows.map(row => ({
			name: String(row.name || ''),
			avatar: getString(row.avatar_url) || '',
			url: String(row.url || ''),
			description: String(row.description || ''),
			stars: getNumber(row.stars) || 0,
			status: getString(row.status) as Blogger['status']
		}))
	} catch {
		return null
	}
}

export async function saveBloggersToD1(db: any, items: Blogger[]): Promise<boolean> {
	try {
		const rows = await getAllRows(db, 'SELECT id, url, name, created_at FROM bloggers')
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.url, row.name))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM bloggers')]

		items.forEach((blogger, index) => {
			const key = normalizeKey(blogger.url, blogger.name)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare(
						`INSERT INTO bloggers (
							id, name, url, avatar_url, description, stars, status, sort_order, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						meta?.id || crypto.randomUUID(),
						blogger.name,
						blogger.url,
						blogger.avatar || null,
						blogger.description || null,
						blogger.stars || 0,
						blogger.status || null,
						index,
						meta?.createdAt || now,
						now
					)
			)
		})

		await runBatch(db, statements)
		return true
	} catch {
		return false
	}
}

export async function getSnippetsFromD1(db: any): Promise<string[] | null> {
	try {
		const rows = await getAllRows(db, 'SELECT content FROM snippets ORDER BY sort_order ASC, created_at ASC')
		return rows.map(row => String(row.content || '')).filter(Boolean)
	} catch {
		return null
	}
}

export async function saveSnippetsToD1(db: any, items: string[]): Promise<boolean> {
	try {
		const rows = await getAllRows(db, 'SELECT id, content, created_at FROM snippets')
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.content))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM snippets')]

		items.forEach((content, index) => {
			const key = normalizeKey(content)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare('INSERT INTO snippets (id, content, sort_order, created_at) VALUES (?, ?, ?, ?)')
					.bind(meta?.id || crypto.randomUUID(), content, index, meta?.createdAt || now)
			)
		})

		await runBatch(db, statements)
		return true
	} catch {
		return false
	}
}

export async function getPicturesFromD1(db: any): Promise<Picture[] | null> {
	try {
		const rows = await getAllRows(
			db,
			'SELECT id, description, uploaded_at, image_url, images_json, created_at FROM pictures ORDER BY COALESCE(uploaded_at, created_at) DESC'
		)

		return rows.map(row => {
			const images = parseStringArray(row.images_json)
			const image = getString(row.image_url)
			return {
				id: String(row.id || ''),
				description: getString(row.description),
				uploadedAt: getString(row.uploaded_at) || getString(row.created_at) || '',
				image,
				images: images.length > 0 ? images : image ? [image] : undefined
			}
		})
	} catch {
		return null
	}
}

export async function savePicturesToD1(db: any, items: Picture[]): Promise<boolean> {
	try {
		const rows = await getAllRows(db, 'SELECT id, created_at FROM pictures')
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.id))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM pictures'), db.prepare('DELETE FROM picture_items')]

		items.forEach(picture => {
			const meta = existing.get(normalizeKey(picture.id))
			statements.push(
				db
					.prepare(
						`INSERT INTO pictures (
							id, description, uploaded_at, image_url, images_json, created_at
						) VALUES (?, ?, ?, ?, ?, ?)`
					)
					.bind(
						picture.id,
						picture.description || null,
						picture.uploadedAt || meta?.createdAt || now,
						picture.image || null,
						JSON.stringify(picture.images || []),
						meta?.createdAt || now
					)
			)
		})

		await runBatch(db, statements)
		return true
	} catch {
		return false
	}
}
