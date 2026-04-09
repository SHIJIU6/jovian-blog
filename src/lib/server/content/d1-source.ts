import type { CategoriesConfig } from '@/hooks/use-categories'
import type { ContentListOptions, ContentPostDetail, ContentPostListItem } from './types'

function splitCsv(value: unknown): string[] {
	if (typeof value !== 'string' || value.length === 0) return []
	return value
		.split(',')
		.map(item => item.trim())
		.filter(Boolean)
}

function mapRowToPost(row: Record<string, unknown>): ContentPostListItem {
	const categoryList = splitCsv(row.categories)
	const status = typeof row.status === 'string' ? (row.status as string) : undefined

	return {
		id: typeof row.id === 'string' ? (row.id as string) : undefined,
		slug: String(row.slug || ''),
		title: String(row.title || ''),
		summary: typeof row.summary === 'string' ? (row.summary as string) : undefined,
		tags: splitCsv(row.tags),
		date: String(row.date || row.published_at || row.updated_at || row.created_at || ''),
		cover: typeof row.cover === 'string' ? (row.cover as string) : undefined,
		hidden: status ? status !== 'published' : Boolean(row.hidden),
		category: categoryList[0],
		status,
		createdAt: typeof row.created_at === 'string' ? (row.created_at as string) : undefined,
		updatedAt: typeof row.updated_at === 'string' ? (row.updated_at as string) : undefined,
		publishedAt: typeof row.published_at === 'string' ? (row.published_at as string) : undefined
	}
}

/**
 * Reference: Cloudflare D1 Worker API docs (retrieved via Context7 against Cloudflare D1 docs).
 * We rely on prepared statements and bind parameters so the same queries remain safe when the blog runs on Workers.
 */
export async function listPostsFromD1(db: any, options: ContentListOptions = {}): Promise<ContentPostListItem[] | null> {
	try {
		const query = `
			SELECT
				p.id,
				p.slug,
				p.title,
				p.summary,
				p.cover_url AS cover,
				p.display_date AS date,
				p.status,
				p.created_at,
				p.updated_at,
				p.published_at,
				COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tags,
				COALESCE(GROUP_CONCAT(DISTINCT c.name), '') AS categories
			FROM posts p
			LEFT JOIN post_tags pt ON pt.post_id = p.id
			LEFT JOIN tags t ON t.id = pt.tag_id
			LEFT JOIN post_categories pc ON pc.post_id = p.id
			LEFT JOIN categories c ON c.id = pc.category_id
			WHERE p.deleted_at IS NULL
			  AND (? = 1 OR p.status = 'published')
			GROUP BY p.id
			ORDER BY COALESCE(p.display_date, p.published_at, p.updated_at, p.created_at) DESC
		`
		const result = await db.prepare(query).bind(options.includeHidden ? 1 : 0).all()
		const rows = Array.isArray(result?.results) ? result.results : []
		const mapped = rows.map((row: Record<string, unknown>) => mapRowToPost(row))
		return typeof options.limit === 'number' ? mapped.slice(0, options.limit) : mapped
	} catch {
		return null
	}
}

export async function getPostFromD1(db: any, slug: string, options: ContentListOptions = {}): Promise<ContentPostDetail | null> {
	try {
		const query = `
			SELECT
				p.id,
				p.slug,
				p.title,
				p.summary,
				p.cover_url AS cover,
				p.display_date AS date,
				p.status,
				p.content_md,
				p.created_at,
				p.updated_at,
				p.published_at,
				COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tags,
				COALESCE(GROUP_CONCAT(DISTINCT c.name), '') AS categories
			FROM posts p
			LEFT JOIN post_tags pt ON pt.post_id = p.id
			LEFT JOIN tags t ON t.id = pt.tag_id
			LEFT JOIN post_categories pc ON pc.post_id = p.id
			LEFT JOIN categories c ON c.id = pc.category_id
			WHERE p.slug = ?
			  AND p.deleted_at IS NULL
			  AND (? = 1 OR p.status = 'published')
			GROUP BY p.id
			LIMIT 1
		`
		const result = await db.prepare(query).bind(slug, options.includeHidden ? 1 : 0).all()
		const row = Array.isArray(result?.results) ? result.results[0] : null
		if (!row) return null
		return {
			...mapRowToPost(row as Record<string, unknown>),
			markdown: String((row as Record<string, unknown>).content_md || '')
		}
	} catch {
		return null
	}
}

export async function getCategoriesFromD1(db: any): Promise<CategoriesConfig | null> {
	try {
		const result = await db.prepare('SELECT name FROM categories ORDER BY sort_order ASC, created_at ASC').all()
		const rows = Array.isArray(result?.results) ? result.results : []
		return {
			categories: rows.map((row: Record<string, unknown>) => String(row.name || '')).filter(Boolean)
		}
	} catch {
		return null
	}
}
