import path from 'node:path'
import { promises as fs } from 'node:fs'
import { defaultCardStyles, defaultSiteContent } from '@/config/default-content'
import type { Project } from '@/app/projects/components/project-card'
import type { Share } from '@/app/share/components/share-card'
import type { Blogger } from '@/app/bloggers/grid-view'
import type { SiteContent, CardStyles } from '@/app/(home)/stores/config-store'
import type { AboutData } from '@/app/about/services/push-about'
import type { Picture } from '@/app/pictures/page'
import { getContentBindings } from './cloudflare'
import { isD1ScopeInitialized } from './d1-state'
import { getProjectRoot } from '../project-root'
import { ensureLocalContentDir, ensureLocalContentLayout, getLocalContentPath, resolveContentReadPath } from '../local-content'
import {
	getBloggersFromD1,
	getPicturesFromD1,
	getProjectsFromD1,
	getSharesFromD1,
	getSnippetsFromD1,
	saveBloggersToD1,
	savePicturesToD1,
	saveProjectsToD1,
	saveSharesToD1,
	saveSnippetsToD1
} from './structured-d1'
import { normalizeBloggerId, normalizeProjectId, normalizeShareId, normalizeSnippetItems, type SnippetItem } from '@/lib/content-item-id'
import type { PaginatedResponse, PaginationParams } from '@/lib/pagination'

const ROOT = getProjectRoot()

const FILES = {
	siteContent: path.join(ROOT, 'seeds', 'content', 'site-content.json'),
	cardStyles: path.join(ROOT, 'seeds', 'content', 'card-styles.json'),
	about: path.join(ROOT, 'seeds', 'content', 'about.json'),
	projects: path.join(ROOT, 'seeds', 'content', 'projects.json'),
	shares: path.join(ROOT, 'seeds', 'content', 'shares.json'),
	bloggers: path.join(ROOT, 'seeds', 'content', 'bloggers.json'),
	snippets: path.join(ROOT, 'seeds', 'content', 'snippets.json'),
	pictures: path.join(ROOT, 'seeds', 'content', 'pictures.json')
}

const LOCAL_FILES = {
	siteContent: getLocalContentPath('content', 'site-content.json'),
	cardStyles: getLocalContentPath('content', 'card-styles.json'),
	about: getLocalContentPath('content', 'about.json'),
	projects: getLocalContentPath('content', 'projects.json'),
	shares: getLocalContentPath('content', 'shares.json'),
	bloggers: getLocalContentPath('content', 'bloggers.json'),
	snippets: getLocalContentPath('content', 'snippets.json'),
	pictures: getLocalContentPath('content', 'pictures.json')
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
	await ensureLocalContentDir(filePath)
	await fs.writeFile(filePath, JSON.stringify(value, null, '\t'), 'utf8')
}

function normalizeProjects(items: Project[]) {
	return items.map(project => ({
		...project,
		id: normalizeProjectId(project)
	}))
}

function normalizeShares(items: Share[]) {
	return items.map(share => ({
		...share,
		id: normalizeShareId(share)
	}))
}

function normalizeBloggers(items: Blogger[]) {
	return items.map(blogger => ({
		...blogger,
		id: normalizeBloggerId(blogger)
	}))
}

function normalizeSnippets(items: Array<SnippetItem | string>) {
	return normalizeSnippetItems(items).filter(item => item.content)
}

type StructuredListOptions = Partial<Pick<PaginationParams, 'limit' | 'offset' | 'page' | 'pageSize'>>

function sliceByOptions<T>(items: T[], options: StructuredListOptions = {}) {
	if (typeof options.limit !== 'number') return items
	return items.slice(options.offset || 0, (options.offset || 0) + options.limit)
}

async function getPagedItems<T>(params: PaginationParams, loader: (options: StructuredListOptions) => Promise<T[]>): Promise<PaginatedResponse<T>> {
	const items = await loader({ limit: params.pageSize + 1, offset: params.offset })
	return {
		items: items.slice(0, params.pageSize),
		page: params.page,
		pageSize: params.pageSize,
		hasMore: items.length > params.pageSize
	}
}

async function readSetting<T>(key: string, fallback: T): Promise<T> {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		try {
			const row = await env.BLOG_DB.prepare('SELECT value_json FROM site_settings WHERE key = ? LIMIT 1').bind(key).first()
			if (row?.value_json) {
				return JSON.parse(String(row.value_json)) as T
			}
		} catch {
			// fall through
		}
	}
	return fallback
}

async function writeSetting(key: string, value: unknown) {
	const env = await getContentBindings()
	if (!env?.BLOG_DB) {
		return false
	}

	try {
		const now = new Date().toISOString()
		await env.BLOG_DB.prepare(
			'INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at'
		)
			.bind(key, JSON.stringify(value), now)
			.run()
		return true
	} catch {
		return false
	}
}

export async function getSiteConfig() {
	await ensureLocalContentLayout()
	const siteContent = await readSetting<SiteContent>(
		'site_content',
		await readJsonFile(resolveContentReadPath(FILES.siteContent, LOCAL_FILES.siteContent), defaultSiteContent)
	)
	const cardStyles = await readSetting<CardStyles>(
		'card_styles',
		await readJsonFile(resolveContentReadPath(FILES.cardStyles, LOCAL_FILES.cardStyles), defaultCardStyles)
	)
	return { siteContent, cardStyles }
}

export async function saveSiteConfig(input: { siteContent: SiteContent; cardStyles: CardStyles }) {
	await ensureLocalContentLayout()
	const siteContentSaved = await writeSetting('site_content', input.siteContent)
	const cardStylesSaved = await writeSetting('card_styles', input.cardStyles)
	if (siteContentSaved && cardStylesSaved) {
		return
	}

	await writeJsonFile(LOCAL_FILES.siteContent, input.siteContent)
	await writeJsonFile(LOCAL_FILES.cardStyles, input.cardStyles)
}

export async function getAboutData() {
	await ensureLocalContentLayout()
	return readSetting<AboutData>(
		'about_page',
		await readJsonFile<AboutData>(resolveContentReadPath(FILES.about, LOCAL_FILES.about), {
			title: '关于',
			description: '',
			content: ''
		})
	)
}

export async function saveAboutData(value: AboutData) {
	await ensureLocalContentLayout()
	if (await writeSetting('about_page', value)) {
		return
	}
	await writeJsonFile(LOCAL_FILES.about, value)
}

export async function getProjects(options: StructuredListOptions = {}) {
	await ensureLocalContentLayout()
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getProjectsFromD1(env.BLOG_DB, options)
		if (result && (result.length > 0 || (await isD1ScopeInitialized(env.BLOG_DB, 'projects')))) return normalizeProjects(result)
	}

	return sliceByOptions(
		normalizeProjects(
		await readSetting<Project[]>('projects_list', await readJsonFile<Project[]>(resolveContentReadPath(FILES.projects, LOCAL_FILES.projects), []))
		),
		options
	)
}

export async function getPaginatedProjects(params: PaginationParams) {
	return getPagedItems(params, getProjects)
}

export async function saveProjects(items: Project[]) {
	await ensureLocalContentLayout()
	const normalizedItems = normalizeProjects(items)
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveProjectsToD1(env.BLOG_DB, normalizedItems)
		if (saved) return
		if (await writeSetting('projects_list', normalizedItems)) return
	}
	await writeJsonFile(LOCAL_FILES.projects, normalizedItems)
}

export async function getShares(options: StructuredListOptions = {}) {
	await ensureLocalContentLayout()
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getSharesFromD1(env.BLOG_DB, options)
		if (result && (result.length > 0 || (await isD1ScopeInitialized(env.BLOG_DB, 'shares')))) return normalizeShares(result)
	}

	return sliceByOptions(normalizeShares(await readSetting<Share[]>('shares_list', await readJsonFile<Share[]>(resolveContentReadPath(FILES.shares, LOCAL_FILES.shares), []))), options)
}

export async function getPaginatedShares(params: PaginationParams) {
	return getPagedItems(params, getShares)
}

export async function saveShares(items: Share[]) {
	await ensureLocalContentLayout()
	const normalizedItems = normalizeShares(items)
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveSharesToD1(env.BLOG_DB, normalizedItems)
		if (saved) return
		if (await writeSetting('shares_list', normalizedItems)) return
	}
	await writeJsonFile(LOCAL_FILES.shares, normalizedItems)
}

export async function getBloggers(options: StructuredListOptions = {}) {
	await ensureLocalContentLayout()
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getBloggersFromD1(env.BLOG_DB, options)
		if (result && (result.length > 0 || (await isD1ScopeInitialized(env.BLOG_DB, 'bloggers')))) return normalizeBloggers(result)
	}

	return sliceByOptions(
		normalizeBloggers(
		await readSetting<Blogger[]>('bloggers_list', await readJsonFile<Blogger[]>(resolveContentReadPath(FILES.bloggers, LOCAL_FILES.bloggers), []))
		),
		options
	)
}

export async function getPaginatedBloggers(params: PaginationParams) {
	return getPagedItems(params, getBloggers)
}

export async function saveBloggers(items: Blogger[]) {
	await ensureLocalContentLayout()
	const normalizedItems = normalizeBloggers(items)
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveBloggersToD1(env.BLOG_DB, normalizedItems)
		if (saved) return
		if (await writeSetting('bloggers_list', normalizedItems)) return
	}
	await writeJsonFile(LOCAL_FILES.bloggers, normalizedItems)
}

export async function getSnippets(options: StructuredListOptions = {}) {
	await ensureLocalContentLayout()
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getSnippetsFromD1(env.BLOG_DB, options)
		if (result && (result.length > 0 || (await isD1ScopeInitialized(env.BLOG_DB, 'snippets')))) return normalizeSnippets(result)
	}

	return sliceByOptions(
		normalizeSnippets(
		await readSetting<Array<SnippetItem | string>>(
			'snippets_list',
			await readJsonFile<Array<SnippetItem | string>>(resolveContentReadPath(FILES.snippets, LOCAL_FILES.snippets), [])
		)
		),
		options
	)
}

export async function getPaginatedSnippets(params: PaginationParams) {
	return getPagedItems(params, getSnippets)
}

export async function saveSnippets(items: SnippetItem[]) {
	await ensureLocalContentLayout()
	const normalizedItems = normalizeSnippets(items)
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveSnippetsToD1(env.BLOG_DB, normalizedItems)
		if (saved) return
		if (await writeSetting('snippets_list', normalizedItems)) return
	}
	await writeJsonFile(LOCAL_FILES.snippets, normalizedItems)
}

export async function getPictures(options: StructuredListOptions = {}) {
	await ensureLocalContentLayout()
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getPicturesFromD1(env.BLOG_DB, options)
		if (result && (result.length > 0 || (await isD1ScopeInitialized(env.BLOG_DB, 'pictures')))) return result
	}

	return sliceByOptions(await readSetting<Picture[]>('pictures_list', await readJsonFile<Picture[]>(resolveContentReadPath(FILES.pictures, LOCAL_FILES.pictures), [])), options)
}

export async function getPaginatedPictures(params: PaginationParams) {
	return getPagedItems(params, getPictures)
}

export async function savePictures(items: Picture[]) {
	await ensureLocalContentLayout()
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await savePicturesToD1(env.BLOG_DB, items)
		if (saved) return
		if (await writeSetting('pictures_list', items)) return
	}
	await writeJsonFile(LOCAL_FILES.pictures, items)
}
