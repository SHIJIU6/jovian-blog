import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getContentBindings } from '../content/cloudflare'
import { markD1ScopeInitialized } from '../content/d1-state'
import type { BlogIndexItem } from '@/app/blog/types'
import { normalizeBlogStatus } from '@/lib/blog-status'
import { ensureLocalContentDir, ensureLocalContentLayout, getLocalContentPath } from '../local-content'

type SavePostInput = {
	slug: string
	title: string
	summary?: string
	contentMd: string
	tags: string[]
	category?: string
	coverUrl?: string
	hidden?: boolean
	date?: string
	status?: string
}

type SyncPostIndexInput = {
	originalItems: BlogIndexItem[]
	nextItems: BlogIndexItem[]
	categories: string[]
}

const LOCAL_BLOG_DIR = getLocalContentPath('content', 'blogs')

function getBlogContentPath(...segments: string[]) {
	return path.join(LOCAL_BLOG_DIR, ...segments)
}

async function ensureDir(target: string) {
	await ensureLocalContentDir(target)
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
	try {
		const text = await fs.readFile(filePath, 'utf8')
		return JSON.parse(text) as T
	} catch {
		return fallback
	}
}

async function writeJsonFile(filePath: string, value: unknown) {
	await ensureDir(path.dirname(filePath))
	await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
}

function createBlogIndexItem(input: SavePostInput): BlogIndexItem {
	const status = normalizeBlogStatus(input.status, input.hidden)
	return {
		slug: input.slug,
		title: input.title,
		summary: input.summary,
		tags: input.tags,
		date: input.date || new Date().toISOString(),
		cover: input.coverUrl,
		hidden: status !== 'published',
		category: input.category,
		status
	}
}

async function upsertPostToFiles(input: SavePostInput) {
	await ensureLocalContentLayout()
	const basePath = getBlogContentPath(input.slug)
	await ensureDir(basePath)
	const status = normalizeBlogStatus(input.status, input.hidden)

	const config = {
		title: input.title,
		tags: input.tags,
		date: input.date || new Date().toISOString(),
		summary: input.summary,
		cover: input.coverUrl,
		hidden: status !== 'published',
		category: input.category,
		status
	}

	await fs.writeFile(path.join(basePath, 'index.md'), input.contentMd, 'utf8')
	await writeJsonFile(path.join(basePath, 'config.json'), config)

	const indexPath = getBlogContentPath('index.json')
	const indexItems = await readJsonFile<BlogIndexItem[]>(indexPath, [])
	const nextMap = new Map(indexItems.map(item => [item.slug, item]))
	nextMap.set(input.slug, createBlogIndexItem(input))
	const sorted = Array.from(nextMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	await writeJsonFile(indexPath, sorted)

	const categoriesPath = getBlogContentPath('categories.json')
	const categoriesFile = await readJsonFile<{ categories: string[] }>(categoriesPath, { categories: [] })
	const categorySet = new Set(categoriesFile.categories)
	if (input.category) categorySet.add(input.category)
	await writeJsonFile(categoriesPath, { categories: Array.from(categorySet) })

	return createBlogIndexItem(input)
}

async function removePostFromFiles(slug: string) {
	await ensureLocalContentLayout()
	await fs.rm(getBlogContentPath(slug), { recursive: true, force: true })
	const indexPath = getBlogContentPath('index.json')
	const items = await readJsonFile<BlogIndexItem[]>(indexPath, [])
	await writeJsonFile(
		indexPath,
		items.filter(item => item.slug !== slug)
	)
}

async function syncPostIndexToFiles(input: SyncPostIndexInput) {
	await ensureLocalContentLayout()
	const removedSlugs = input.originalItems.filter(item => !input.nextItems.some(next => next.slug === item.slug)).map(item => item.slug)

	for (const slug of removedSlugs) {
		await fs.rm(getBlogContentPath(slug), { recursive: true, force: true })
	}

	await writeJsonFile(getBlogContentPath('index.json'), [...input.nextItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
	await writeJsonFile(getBlogContentPath('categories.json'), {
		categories: Array.from(new Set(input.categories.map(item => item.trim()).filter(Boolean)))
	})

	for (const item of input.nextItems) {
		const current = await readJsonFile<Record<string, unknown>>(getBlogContentPath(item.slug, 'config.json'), {})
		const status = normalizeBlogStatus(item.status, item.hidden)
		await writeJsonFile(getBlogContentPath(item.slug, 'config.json'), {
			...current,
			title: item.title,
			tags: item.tags,
			date: item.date,
			summary: item.summary,
			cover: item.cover,
			hidden: status !== 'published',
			category: item.category,
			status
		})
	}
}

async function ensureTagIds(db: any, tags: string[]) {
	const ids: string[] = []
	for (const tag of tags.map(item => item.trim()).filter(Boolean)) {
		const existing = await db.prepare('SELECT id FROM tags WHERE name = ? LIMIT 1').bind(tag).first()
		if (existing?.id) {
			ids.push(String(existing.id))
			continue
		}
		const id = crypto.randomUUID()
		await db.prepare('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)').bind(id, tag, new Date().toISOString()).run()
		ids.push(id)
	}
	return ids
}

async function ensureCategoryId(db: any, category?: string) {
	if (!category?.trim()) return null
	const normalized = category.trim()
	const existing = await db.prepare('SELECT id FROM categories WHERE name = ? LIMIT 1').bind(normalized).first()
	if (existing?.id) return String(existing.id)

	const id = crypto.randomUUID()
	const count = await db.prepare('SELECT COUNT(*) as total FROM categories').first()
	const sortOrder = Number(count?.total || 0)
	await db.prepare('INSERT INTO categories (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)').bind(id, normalized, sortOrder, new Date().toISOString()).run()
	return id
}

async function upsertPostToD1(db: any, input: SavePostInput) {
	const now = new Date().toISOString()
	const existing = await db.prepare('SELECT id, created_at FROM posts WHERE slug = ? LIMIT 1').bind(input.slug).first()
	const id = existing?.id ? String(existing.id) : crypto.randomUUID()
	const createdAt = existing?.created_at ? String(existing.created_at) : now
	const status = normalizeBlogStatus(input.status, input.hidden)
	const displayDate = input.date || now
	const publishedAt = status === 'published' ? displayDate : null

	if (existing?.id) {
		await db
			.prepare(
				`UPDATE posts
				 SET title = ?, summary = ?, content_md = ?, cover_url = ?, display_date = ?, status = ?, published_at = ?, updated_at = ?, deleted_at = NULL
				 WHERE id = ?`
			)
			.bind(input.title, input.summary || null, input.contentMd, input.coverUrl || null, displayDate, status, publishedAt, now, id)
			.run()
	} else {
		await db
			.prepare(
				`INSERT INTO posts (id, slug, title, summary, content_md, cover_url, display_date, status, published_at, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(id, input.slug, input.title, input.summary || null, input.contentMd, input.coverUrl || null, displayDate, status, publishedAt, createdAt, now)
			.run()
	}

	const tagIds = await ensureTagIds(db, input.tags)
	await db.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run()
	for (const tagId of tagIds) {
		await db.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)').bind(id, tagId).run()
	}

	const categoryId = await ensureCategoryId(db, input.category)
	await db.prepare('DELETE FROM post_categories WHERE post_id = ?').bind(id).run()
	if (categoryId) {
		await db.prepare('INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)').bind(id, categoryId).run()
	}

	await markD1ScopeInitialized(db, 'posts')

	return createBlogIndexItem({
		...input,
		date: displayDate,
		hidden: status !== 'published',
		status
	})
}

async function removePostFromD1(db: any, slug: string) {
	await db.prepare('UPDATE posts SET deleted_at = ?, updated_at = ? WHERE slug = ?').bind(new Date().toISOString(), new Date().toISOString(), slug).run()
	await markD1ScopeInitialized(db, 'posts')
}

async function syncPostIndexToD1(db: any, input: SyncPostIndexInput) {
	const now = new Date().toISOString()
	const nextMap = new Map(input.nextItems.map(item => [item.slug, item]))
	const removed = input.originalItems.filter(item => !nextMap.has(item.slug)).map(item => item.slug)

	for (const slug of removed) {
		await removePostFromD1(db, slug)
	}

	for (const item of input.nextItems) {
		const status = normalizeBlogStatus(item.status, item.hidden)
		await db
			.prepare(
				`UPDATE posts
				 SET title = ?, summary = ?, cover_url = ?, display_date = ?, status = ?, published_at = ?, updated_at = ?
				 WHERE slug = ?`
			)
			.bind(
				item.title,
				item.summary || null,
				item.cover || null,
				item.date || now,
				status,
				status === 'published' ? item.date || now : null,
				now,
				item.slug
			)
			.run()

		const categoryId = await ensureCategoryId(db, item.category)
		const post = await db.prepare('SELECT id FROM posts WHERE slug = ? LIMIT 1').bind(item.slug).first()
		if (post?.id) {
			await db.prepare('DELETE FROM post_categories WHERE post_id = ?').bind(post.id).run()
			if (categoryId) {
				await db.prepare('INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)').bind(post.id, categoryId).run()
			}
		}
	}

	const existingCategories = await db.prepare('SELECT id, name FROM categories').all()
	const categoryRows = Array.isArray(existingCategories?.results) ? existingCategories.results : []
	for (const [index, name] of Array.from(new Set(input.categories.map(item => item.trim()).filter(Boolean))).entries()) {
		const found = categoryRows.find((row: any) => row.name === name)
		if (found?.id) {
			await db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(index, found.id).run()
		}
	}

	await markD1ScopeInitialized(db, 'posts')
}

export async function savePost(input: SavePostInput) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		try {
			return await upsertPostToD1(env.BLOG_DB, input)
		} catch {
			// Local dev may expose a D1 binding before migrations are applied.
			// Fall back to file persistence so authoring still works.
		}
	}
	return upsertPostToFiles(input)
}

export async function deletePost(slug: string) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		try {
			await removePostFromD1(env.BLOG_DB, slug)
			return
		} catch {
			// Fall back to local files when the local D1 schema is not ready yet.
		}
	}
	await removePostFromFiles(slug)
}

export async function syncPostIndex(input: SyncPostIndexInput) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		try {
			await syncPostIndexToD1(env.BLOG_DB, input)
			return
		} catch {
			// Keep local authoring editable even if the D1 tables are missing locally.
		}
	}
	await syncPostIndexToFiles(input)
}
