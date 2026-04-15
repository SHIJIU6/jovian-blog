import type { Project } from '@/app/projects/components/project-card'
import type { Share } from '@/app/share/components/share-card'
import type { Blogger } from '@/app/bloggers/grid-view'
import type { Picture } from '@/app/pictures/page'
import { markD1ScopeInitialized } from './d1-state'
import type { SnippetItem } from '@/lib/content-item-id'

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
			'SELECT id, name, year, description, image_url, url, tags_json, github_url, npm_url FROM projects ORDER BY sort_order ASC, updated_at DESC, created_at DESC'
		)

		return rows.map(row => ({
			id: String(row.id || ''),
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
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.id, row.url, row.name))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM projects')]

		items.forEach((project, index) => {
			const key = normalizeKey(project.id, project.url, project.name)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare(
						`INSERT INTO projects (
							id, name, description, year, image_url, url, github_url, npm_url, tags_json, sort_order, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						project.id || meta?.id || crypto.randomUUID(),
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
		await markD1ScopeInitialized(db, 'projects')
		return true
	} catch {
		return false
	}
}

export async function getSharesFromD1(db: any): Promise<Share[] | null> {
	try {
		const rows = await getAllRows(
			db,
			'SELECT id, name, logo_url, url, description, tags_json, stars FROM resources ORDER BY sort_order ASC, updated_at DESC, created_at DESC'
		)

		return rows.map(row => ({
			id: String(row.id || ''),
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
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.id, row.url, row.name))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM resources')]

		items.forEach((share, index) => {
			const key = normalizeKey(share.id, share.url, share.name)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare(
						`INSERT INTO resources (
							id, name, description, url, logo_url, stars, tags_json, sort_order, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						share.id || meta?.id || crypto.randomUUID(),
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
		await markD1ScopeInitialized(db, 'shares')
		return true
	} catch {
		return false
	}
}

export async function getBloggersFromD1(db: any): Promise<Blogger[] | null> {
	try {
		const rows = await getAllRows(
			db,
			'SELECT id, name, avatar_url, url, description, stars, status FROM bloggers ORDER BY sort_order ASC, updated_at DESC, created_at DESC'
		)

		return rows.map(row => ({
			id: String(row.id || ''),
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
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.id, row.url, row.name))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM bloggers')]

		items.forEach((blogger, index) => {
			const key = normalizeKey(blogger.id, blogger.url, blogger.name)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare(
						`INSERT INTO bloggers (
							id, name, url, avatar_url, description, stars, status, sort_order, created_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						blogger.id || meta?.id || crypto.randomUUID(),
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
		await markD1ScopeInitialized(db, 'bloggers')
		return true
	} catch {
		return false
	}
}

export async function getSnippetsFromD1(db: any): Promise<SnippetItem[] | null> {
	try {
		const rows = await getAllRows(db, 'SELECT id, content FROM snippets ORDER BY sort_order ASC, created_at ASC')
		return rows
			.map(row => ({
				id: String(row.id || ''),
				content: String(row.content || '')
			}))
			.filter(item => item.content)
	} catch {
		return null
	}
}

export async function saveSnippetsToD1(db: any, items: SnippetItem[]): Promise<boolean> {
	try {
		const rows = await getAllRows(db, 'SELECT id, content, created_at FROM snippets')
		const existing = getExistingMetaMap(rows, row => normalizeKey(row.id, row.content))
		const now = new Date().toISOString()
		const statements = [db.prepare('DELETE FROM snippets')]

		items.forEach((item, index) => {
			const key = normalizeKey(item.id, item.content)
			const meta = existing.get(key)
			statements.push(
				db
					.prepare('INSERT INTO snippets (id, content, sort_order, created_at) VALUES (?, ?, ?, ?)')
					.bind(item.id || meta?.id || crypto.randomUUID(), item.content, index, meta?.createdAt || now)
			)
		})

		await runBatch(db, statements)
		await markD1ScopeInitialized(db, 'snippets')
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
		await markD1ScopeInitialized(db, 'pictures')
		return true
	} catch {
		return false
	}
}

async function getExistingCreatedAt(db: any, table: string, id: string) {
	const row = await db.prepare(`SELECT created_at FROM ${table} WHERE id = ? LIMIT 1`).bind(id).first()
	return getString(row?.created_at)
}

async function reorderTableByIds(db: any, table: string, ids: string[]) {
	if (ids.length === 0) return
	const statements = ids.map((id, index) => db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`).bind(index, id))
	await runBatch(db, statements)
}

async function deleteRowById(db: any, table: string, id: string) {
	await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run()
}

export async function upsertProjectItemToD1(db: any, project: Project, sortOrder: number): Promise<boolean> {
	try {
		const now = new Date().toISOString()
		const createdAt = (await getExistingCreatedAt(db, 'projects', project.id)) || now
		const existing = await db.prepare('SELECT id FROM projects WHERE id = ? LIMIT 1').bind(project.id).first()

		if (existing?.id) {
			await db
				.prepare(
					`UPDATE projects
					 SET name = ?, description = ?, year = ?, image_url = ?, url = ?, github_url = ?, npm_url = ?, tags_json = ?, sort_order = ?, updated_at = ?
					 WHERE id = ?`
				)
				.bind(
					project.name,
					project.description || null,
					project.year || null,
					project.image || null,
					project.url || null,
					project.github || null,
					project.npm || null,
					JSON.stringify(project.tags || []),
					sortOrder,
					now,
					project.id
				)
				.run()
		} else {
			await db
				.prepare(
					`INSERT INTO projects (
						id, name, description, year, image_url, url, github_url, npm_url, tags_json, sort_order, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					project.id,
					project.name,
					project.description || null,
					project.year || null,
					project.image || null,
					project.url || null,
					project.github || null,
					project.npm || null,
					JSON.stringify(project.tags || []),
					sortOrder,
					createdAt,
					now
				)
				.run()
		}

		await markD1ScopeInitialized(db, 'projects')
		return true
	} catch {
		return false
	}
}

export async function deleteProjectItemFromD1(db: any, id: string): Promise<boolean> {
	try {
		await deleteRowById(db, 'projects', id)
		await markD1ScopeInitialized(db, 'projects')
		return true
	} catch {
		return false
	}
}

export async function reorderProjectsInD1(db: any, ids: string[]): Promise<boolean> {
	try {
		await reorderTableByIds(db, 'projects', ids)
		await markD1ScopeInitialized(db, 'projects')
		return true
	} catch {
		return false
	}
}

export async function upsertShareItemToD1(db: any, share: Share, sortOrder: number): Promise<boolean> {
	try {
		const now = new Date().toISOString()
		const createdAt = (await getExistingCreatedAt(db, 'resources', share.id)) || now
		const existing = await db.prepare('SELECT id FROM resources WHERE id = ? LIMIT 1').bind(share.id).first()

		if (existing?.id) {
			await db
				.prepare(
					`UPDATE resources
					 SET name = ?, description = ?, url = ?, logo_url = ?, stars = ?, tags_json = ?, sort_order = ?, updated_at = ?
					 WHERE id = ?`
				)
				.bind(
					share.name,
					share.description || null,
					share.url,
					share.logo || null,
					share.stars || 0,
					JSON.stringify(share.tags || []),
					sortOrder,
					now,
					share.id
				)
				.run()
		} else {
			await db
				.prepare(
					`INSERT INTO resources (
						id, name, description, url, logo_url, stars, tags_json, sort_order, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					share.id,
					share.name,
					share.description || null,
					share.url,
					share.logo || null,
					share.stars || 0,
					JSON.stringify(share.tags || []),
					sortOrder,
					createdAt,
					now
				)
				.run()
		}

		await markD1ScopeInitialized(db, 'shares')
		return true
	} catch {
		return false
	}
}

export async function deleteShareItemFromD1(db: any, id: string): Promise<boolean> {
	try {
		await deleteRowById(db, 'resources', id)
		await markD1ScopeInitialized(db, 'shares')
		return true
	} catch {
		return false
	}
}

export async function reorderSharesInD1(db: any, ids: string[]): Promise<boolean> {
	try {
		await reorderTableByIds(db, 'resources', ids)
		await markD1ScopeInitialized(db, 'shares')
		return true
	} catch {
		return false
	}
}

export async function upsertBloggerItemToD1(db: any, blogger: Blogger, sortOrder: number): Promise<boolean> {
	try {
		const now = new Date().toISOString()
		const createdAt = (await getExistingCreatedAt(db, 'bloggers', blogger.id)) || now
		const existing = await db.prepare('SELECT id FROM bloggers WHERE id = ? LIMIT 1').bind(blogger.id).first()

		if (existing?.id) {
			await db
				.prepare(
					`UPDATE bloggers
					 SET name = ?, url = ?, avatar_url = ?, description = ?, stars = ?, status = ?, sort_order = ?, updated_at = ?
					 WHERE id = ?`
				)
				.bind(
					blogger.name,
					blogger.url,
					blogger.avatar || null,
					blogger.description || null,
					blogger.stars || 0,
					blogger.status || null,
					sortOrder,
					now,
					blogger.id
				)
				.run()
		} else {
			await db
				.prepare(
					`INSERT INTO bloggers (
						id, name, url, avatar_url, description, stars, status, sort_order, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					blogger.id,
					blogger.name,
					blogger.url,
					blogger.avatar || null,
					blogger.description || null,
					blogger.stars || 0,
					blogger.status || null,
					sortOrder,
					createdAt,
					now
				)
				.run()
		}

		await markD1ScopeInitialized(db, 'bloggers')
		return true
	} catch {
		return false
	}
}

export async function deleteBloggerItemFromD1(db: any, id: string): Promise<boolean> {
	try {
		await deleteRowById(db, 'bloggers', id)
		await markD1ScopeInitialized(db, 'bloggers')
		return true
	} catch {
		return false
	}
}

export async function reorderBloggersInD1(db: any, ids: string[]): Promise<boolean> {
	try {
		await reorderTableByIds(db, 'bloggers', ids)
		await markD1ScopeInitialized(db, 'bloggers')
		return true
	} catch {
		return false
	}
}

export async function upsertSnippetItemToD1(db: any, snippet: SnippetItem, sortOrder: number): Promise<boolean> {
	try {
		const now = new Date().toISOString()
		const createdAt = (await getExistingCreatedAt(db, 'snippets', snippet.id)) || now
		const existing = await db.prepare('SELECT id FROM snippets WHERE id = ? LIMIT 1').bind(snippet.id).first()

		if (existing?.id) {
			await db
				.prepare('UPDATE snippets SET content = ?, sort_order = ? WHERE id = ?')
				.bind(snippet.content, sortOrder, snippet.id)
				.run()
		} else {
			await db
				.prepare('INSERT INTO snippets (id, content, sort_order, created_at) VALUES (?, ?, ?, ?)')
				.bind(snippet.id, snippet.content, sortOrder, createdAt)
				.run()
		}

		await markD1ScopeInitialized(db, 'snippets')
		return true
	} catch {
		return false
	}
}

export async function deleteSnippetItemFromD1(db: any, id: string): Promise<boolean> {
	try {
		await deleteRowById(db, 'snippets', id)
		await markD1ScopeInitialized(db, 'snippets')
		return true
	} catch {
		return false
	}
}

export async function reorderSnippetsInD1(db: any, ids: string[]): Promise<boolean> {
	try {
		await reorderTableByIds(db, 'snippets', ids)
		await markD1ScopeInitialized(db, 'snippets')
		return true
	} catch {
		return false
	}
}

export async function upsertPictureItemToD1(db: any, picture: Picture): Promise<boolean> {
	try {
		const now = new Date().toISOString()
		const createdAt = (await getExistingCreatedAt(db, 'pictures', picture.id)) || now
		const existing = await db.prepare('SELECT id FROM pictures WHERE id = ? LIMIT 1').bind(picture.id).first()
		const normalizedImages = Array.isArray(picture.images) && picture.images.length > 0 ? picture.images.filter(Boolean) : picture.image ? [picture.image] : []
		const primaryImage = normalizedImages[0] || picture.image || null

		if (existing?.id) {
			await db
				.prepare('UPDATE pictures SET description = ?, uploaded_at = ?, image_url = ?, images_json = ? WHERE id = ?')
				.bind(
					picture.description || null,
					picture.uploadedAt || createdAt,
					primaryImage,
					JSON.stringify(normalizedImages),
					picture.id
				)
				.run()
		} else {
			await db
				.prepare('INSERT INTO pictures (id, description, uploaded_at, image_url, images_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
				.bind(
					picture.id,
					picture.description || null,
					picture.uploadedAt || now,
					primaryImage,
					JSON.stringify(normalizedImages),
					createdAt
				)
				.run()
		}

		await markD1ScopeInitialized(db, 'pictures')
		return true
	} catch {
		return false
	}
}

export async function deletePictureItemFromD1(db: any, id: string): Promise<boolean> {
	try {
		await db.prepare('DELETE FROM picture_items WHERE picture_id = ?').bind(id).run()
		await deleteRowById(db, 'pictures', id)
		await markD1ScopeInitialized(db, 'pictures')
		return true
	} catch {
		return false
	}
}
