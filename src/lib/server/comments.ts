import { promises as fs } from 'node:fs'
import { getContentBindings } from './content/cloudflare'
import { ensureLocalContentDir, getLocalContentPath } from './local-content'
import { COMMENT_TARGET_TYPES, isCommentTargetType, type CommentCreateInput, type CommentItem, type CommentStatus, type CommentTargetType } from '@/lib/comment-types'

const LOCAL_COMMENTS_FILE = getLocalContentPath('runtime', 'comments', 'comments.json')
const COMMENT_TABLE = 'comments'
const MAX_CONTENT_LENGTH = 1000
const MAX_NAME_LENGTH = 40
const MAX_EMAIL_LENGTH = 120
const MAX_URL_LENGTH = 200
let commentsTableReady = false

type LocalCommentStore = {
	items: CommentItem[]
}

type CommentListOptions = {
	includePending?: boolean
	includePrivate?: boolean
	status?: CommentStatus | 'all'
	targetType?: CommentTargetType | 'all'
	targetId?: string
	query?: string
	offset?: number
	limit?: number
}

const EMPTY_STORE: LocalCommentStore = {
	items: []
}

let localMutationQueue: Promise<void> = Promise.resolve()
let volatileStore: LocalCommentStore = { items: [] }

function normalizeText(value: unknown, maxLength: number) {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength)
}

function normalizeContent(value: unknown) {
	return String(value || '')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.trim()
		.slice(0, MAX_CONTENT_LENGTH)
}

function normalizeTargetType(value: unknown): CommentTargetType {
	const next = String(value || '').trim()
	if (!isCommentTargetType(next)) {
		throw new Error(`Unsupported comment target type. Expected one of: ${COMMENT_TARGET_TYPES.join(', ')}`)
	}
	return next
}

function normalizeUrl(value: unknown) {
	const next = normalizeText(value, MAX_URL_LENGTH)
	if (!next) return undefined
	if (!/^https?:\/\//i.test(next)) return undefined
	return next
}

function normalizeEmail(value: unknown) {
	const next = normalizeText(value, MAX_EMAIL_LENGTH)
	if (!next) return undefined
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
		throw new Error('邮箱格式不正确')
	}
	return next
}

function isPublicStatus(status: CommentStatus) {
	return status === 'approved'
}

function getSearchText(item: CommentItem) {
	return [item.authorName, item.authorEmail, item.authorUrl, item.content, item.targetType, item.targetId].filter(Boolean).join(' ').toLowerCase()
}

function getDefaultStatus(): CommentStatus {
	return process.env.COMMENTS_REQUIRE_APPROVAL === 'true' ? 'pending' : 'approved'
}

async function hashText(value: string) {
	if (!value) return undefined
	const input = new TextEncoder().encode(value)
	const digest = await crypto.subtle.digest('SHA-256', input)
	return Array.from(new Uint8Array(digest))
		.map(item => item.toString(16).padStart(2, '0'))
		.join('')
}

async function readLocalStore(): Promise<LocalCommentStore> {
	try {
		const text = await fs.readFile(LOCAL_COMMENTS_FILE, 'utf8')
		const parsed = JSON.parse(text) as Partial<LocalCommentStore>
		return {
			items: Array.isArray(parsed.items) ? parsed.items : []
		}
	} catch {
		return { ...EMPTY_STORE, items: [...volatileStore.items] }
	}
}

async function writeLocalStore(store: LocalCommentStore) {
	volatileStore = { items: [...store.items] }
	try {
		await ensureLocalContentDir(LOCAL_COMMENTS_FILE)
		await fs.writeFile(LOCAL_COMMENTS_FILE, JSON.stringify(store, null, 2), 'utf8')
	} catch {
		// Keep an in-memory fallback so local comments still work during read-only runs.
	}
}

async function withLocalStoreMutation<T>(mutate: (store: LocalCommentStore) => Promise<T> | T): Promise<T> {
	let result!: T
	const run = localMutationQueue.then(async () => {
		const store = await readLocalStore()
		result = await mutate(store)
		await writeLocalStore(store)
	})
	localMutationQueue = run.then(() => undefined, () => undefined)
	await run
	return result
}

function mapD1Comment(row: Record<string, unknown>): CommentItem {
	return {
		id: String(row.id || ''),
		targetType: normalizeTargetType(row.target_type),
		targetId: String(row.target_id || ''),
		parentId: row.parent_id ? String(row.parent_id) : undefined,
		authorName: String(row.author_name || '匿名访客'),
		authorEmail: row.author_email ? String(row.author_email) : undefined,
		authorUrl: row.author_url ? String(row.author_url) : undefined,
		content: String(row.content || ''),
		status: String(row.status || 'approved') as CommentStatus,
		ipHash: row.ip_hash ? String(row.ip_hash) : undefined,
		userAgentHash: row.user_agent_hash ? String(row.user_agent_hash) : undefined,
		createdAt: String(row.created_at || ''),
		updatedAt: String(row.updated_at || '')
	}
}

function toPublicComment(item: CommentItem): CommentItem {
	return {
		...item,
		authorEmail: undefined,
		ipHash: undefined,
		userAgentHash: undefined
	}
}

async function ensureCommentsTable(db: any) {
	if (commentsTableReady) return

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS ${COMMENT_TABLE} (
				id TEXT PRIMARY KEY,
				target_type TEXT NOT NULL,
				target_id TEXT NOT NULL,
				parent_id TEXT,
				author_name TEXT NOT NULL,
				author_email TEXT,
				author_url TEXT,
				content TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'approved',
				ip_hash TEXT,
				user_agent_hash TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`
		)
		.run()
	await db.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_target ON ${COMMENT_TABLE}(target_type, target_id, status, created_at)`).run()
	await db.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_status ON ${COMMENT_TABLE}(status, created_at)`).run()

	commentsTableReady = true
}

async function listCommentsFromD1(db: any, targetType: CommentTargetType, targetId: string, options: CommentListOptions): Promise<CommentItem[] | null> {
	try {
		await ensureCommentsTable(db)
		const limit = Math.min(Math.max(options.limit || 50, 1), 100)
		const offset = Math.max(options.offset || 0, 0)
		const statuses = options.includePending ? ['approved', 'pending'] : ['approved']
		const placeholders = statuses.map(() => '?').join(', ')
		const query = normalizeText(options.query, 120).toLowerCase()
		const searchClause = query ? 'AND (lower(author_name) LIKE ? OR lower(author_url) LIKE ? OR lower(content) LIKE ?)' : ''
		const searchBindings = query ? [`%${query}%`, `%${query}%`, `%${query}%`] : []
		const result = await db
			.prepare(
				`SELECT id, target_type, target_id, parent_id, author_name, author_email, author_url, content, status, created_at, updated_at
				 FROM ${COMMENT_TABLE}
				 WHERE target_type = ? AND target_id = ? AND status IN (${placeholders})
				 ${searchClause}
				 ORDER BY created_at DESC
				 LIMIT ? OFFSET ?`
			)
			.bind(targetType, targetId, ...statuses, ...searchBindings, limit, offset)
			.all()
		const rows = Array.isArray(result?.results) ? result.results : []
		const items = rows.map((row: Record<string, unknown>) => mapD1Comment(row)).reverse()
		return options.includePrivate ? items : items.map(toPublicComment)
	} catch {
		return null
	}
}

async function listAllCommentsFromD1(db: any, options: CommentListOptions): Promise<CommentItem[] | null> {
	try {
		await ensureCommentsTable(db)
		const limit = Math.min(Math.max(options.limit || 100, 1), 300)
		const offset = Math.max(options.offset || 0, 0)
		const where: string[] = []
		const bindings: unknown[] = []

		if (options.status && options.status !== 'all') {
			where.push('status = ?')
			bindings.push(options.status)
		}

		if (options.targetType && options.targetType !== 'all') {
			where.push('target_type = ?')
			bindings.push(options.targetType)
		}

		if (options.targetId) {
			where.push('target_id = ?')
			bindings.push(options.targetId)
		}

		const query = normalizeText(options.query, 120).toLowerCase()
		if (query) {
			where.push('(lower(author_name) LIKE ? OR lower(author_email) LIKE ? OR lower(author_url) LIKE ? OR lower(content) LIKE ? OR lower(target_id) LIKE ?)')
			bindings.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`)
		}

		const result = await db
			.prepare(
				`SELECT id, target_type, target_id, parent_id, author_name, author_email, author_url, content, status, ip_hash, user_agent_hash, created_at, updated_at
				 FROM ${COMMENT_TABLE}
				 ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
				 ORDER BY created_at DESC
				 LIMIT ? OFFSET ?`
			)
			.bind(...bindings, limit, offset)
			.all()
		const rows = Array.isArray(result?.results) ? result.results : []
		return rows.map((row: Record<string, unknown>) => mapD1Comment(row))
	} catch {
		return null
	}
}

async function createCommentInD1(db: any, item: CommentItem, ipHash?: string, userAgentHash?: string): Promise<CommentItem> {
	try {
		await ensureCommentsTable(db)
		await db
			.prepare(
				`INSERT INTO ${COMMENT_TABLE} (
					id, target_type, target_id, parent_id, author_name, author_email, author_url, content, status, ip_hash, user_agent_hash, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				item.id,
				item.targetType,
				item.targetId,
				item.parentId || null,
				item.authorName,
				item.authorEmail || null,
				item.authorUrl || null,
				item.content,
				item.status,
				ipHash || null,
				userAgentHash || null,
				item.createdAt,
				item.updatedAt
			)
			.run()

		const row = await db
			.prepare(
				`SELECT id, target_type, target_id, parent_id, author_name, author_email, author_url, content, status, ip_hash, user_agent_hash, created_at, updated_at
				 FROM ${COMMENT_TABLE} WHERE id = ? LIMIT 1`
			)
			.bind(item.id)
			.first()
		if (!row) throw new Error('留言写入后未能读取，请检查数据库权限')
		return mapD1Comment(row as Record<string, unknown>)
	} catch (error: any) {
		throw new Error(`留言保存到数据库失败：${error?.message || '请确认 comments 表迁移已执行'}`)
	}
}

async function updateCommentStatusInD1(db: any, id: string, status: CommentStatus): Promise<CommentItem | null> {
	try {
		await ensureCommentsTable(db)
		const now = new Date().toISOString()
		await db.prepare(`UPDATE ${COMMENT_TABLE} SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, id).run()
		const row = await db
			.prepare(
				`SELECT id, target_type, target_id, parent_id, author_name, author_email, author_url, content, status, ip_hash, user_agent_hash, created_at, updated_at
				 FROM ${COMMENT_TABLE} WHERE id = ? LIMIT 1`
			)
			.bind(id)
			.first()
		return row ? mapD1Comment(row as Record<string, unknown>) : null
	} catch {
		return null
	}
}

function filterLocalComments(store: LocalCommentStore, targetType: CommentTargetType, targetId: string, options: CommentListOptions) {
	const limit = Math.min(Math.max(options.limit || 50, 1), 100)
	const offset = Math.max(options.offset || 0, 0)
	const query = normalizeText(options.query, 120).toLowerCase()
	return store.items
		.filter(item => item.targetType === targetType && item.targetId === targetId)
		.filter(item => (options.includePending ? item.status === 'approved' || item.status === 'pending' : isPublicStatus(item.status)))
		.filter(item => !query || getSearchText(item).includes(query))
		.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
		.slice(offset, offset + limit)
		.map(item => (options.includePrivate ? item : toPublicComment(item)))
}

function filterAllLocalComments(store: LocalCommentStore, options: CommentListOptions) {
	const limit = Math.min(Math.max(options.limit || 100, 1), 300)
	const offset = Math.max(options.offset || 0, 0)
	const query = normalizeText(options.query, 120).toLowerCase()
	return store.items
		.filter(item => !options.status || options.status === 'all' || item.status === options.status)
		.filter(item => !options.targetType || options.targetType === 'all' || item.targetType === options.targetType)
		.filter(item => !options.targetId || item.targetId === options.targetId)
		.filter(item => !query || getSearchText(item).includes(query))
		.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
		.slice(offset, offset + limit)
}

export async function listComments(targetTypeInput: string, targetIdInput: string, options: CommentListOptions = {}) {
	const targetType = normalizeTargetType(targetTypeInput)
	const targetId = normalizeText(targetIdInput, 160)
	if (!targetId) return []

	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const items = await listCommentsFromD1(env.BLOG_DB, targetType, targetId, options)
		if (items) return items
	}

	return filterLocalComments(await readLocalStore(), targetType, targetId, options)
}

export async function listAllComments(options: CommentListOptions = {}) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const items = await listAllCommentsFromD1(env.BLOG_DB, { ...options, includePrivate: true })
		if (items) return items
	}

	return filterAllLocalComments(await readLocalStore(), { ...options, includePrivate: true })
}

export async function updateCommentStatus(idInput: string, status: CommentStatus) {
	const id = normalizeText(idInput, 160)
	if (!id) throw new Error('Missing comment id')

	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const item = await updateCommentStatusInD1(env.BLOG_DB, id, status)
		if (item) return item
	}

	return withLocalStoreMutation(store => {
		const item = store.items.find(comment => comment.id === id)
		if (!item) throw new Error('留言不存在')
		item.status = status
		item.updatedAt = new Date().toISOString()
		return item
	})
}

export async function createComment(input: CommentCreateInput, requestMeta?: { ip?: string; userAgent?: string }) {
	const targetType = normalizeTargetType(input.targetType)
	const targetId = normalizeText(input.targetId, 160)
	const content = normalizeContent(input.content)
	if (!targetId) throw new Error('Missing comment target')
	if (!content) throw new Error('留言内容不能为空')

	const now = new Date().toISOString()
	const item: CommentItem = {
		id: crypto.randomUUID(),
		targetType,
		targetId,
		parentId: normalizeText(input.parentId, 160) || undefined,
		authorName: normalizeText(input.authorName, MAX_NAME_LENGTH) || '匿名访客',
		authorEmail: normalizeEmail(input.authorEmail),
		authorUrl: normalizeUrl(input.authorUrl),
		content,
		status: getDefaultStatus(),
		createdAt: now,
		updatedAt: now
	}

	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		return createCommentInD1(env.BLOG_DB, item, await hashText(requestMeta?.ip || ''), await hashText(requestMeta?.userAgent || ''))
	}

	return withLocalStoreMutation(store => {
		store.items.push(item)
		return item
	})
}
