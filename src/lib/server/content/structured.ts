import path from 'node:path'
import { promises as fs } from 'node:fs'
import siteContentDefault from '@/config/site-content.json'
import cardStylesDefault from '@/config/card-styles.json'
import type { Project } from '@/app/projects/components/project-card'
import type { Share } from '@/app/share/components/share-card'
import type { Blogger } from '@/app/bloggers/grid-view'
import type { SiteContent, CardStyles } from '@/app/(home)/stores/config-store'
import type { AboutData } from '@/app/about/services/push-about'
import type { Picture } from '@/app/pictures/page'
import { getContentBindings } from './cloudflare'
import { getProjectRoot } from '../project-root'
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

const ROOT = getProjectRoot()

const FILES = {
	siteContent: path.join(ROOT, 'src', 'config', 'site-content.json'),
	cardStyles: path.join(ROOT, 'src', 'config', 'card-styles.json'),
	about: path.join(ROOT, 'src', 'app', 'about', 'list.json'),
	projects: path.join(ROOT, 'src', 'app', 'projects', 'list.json'),
	shares: path.join(ROOT, 'src', 'app', 'share', 'list.json'),
	bloggers: path.join(ROOT, 'src', 'app', 'bloggers', 'list.json'),
	snippets: path.join(ROOT, 'src', 'app', 'snippets', 'list.json')
	,
	pictures: path.join(ROOT, 'src', 'app', 'pictures', 'list.json')
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
	await fs.mkdir(path.dirname(filePath), { recursive: true })
	await fs.writeFile(filePath, JSON.stringify(value, null, '\t'), 'utf8')
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
	if (env?.BLOG_DB) {
		const now = new Date().toISOString()
		await env.BLOG_DB.prepare(
			'INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at'
		)
			.bind(key, JSON.stringify(value), now)
			.run()
		return
	}
}

export async function getSiteConfig() {
	const siteContent = await readSetting<SiteContent>('site_content', await readJsonFile(FILES.siteContent, siteContentDefault))
	const cardStyles = await readSetting<CardStyles>('card_styles', await readJsonFile(FILES.cardStyles, cardStylesDefault))
	return { siteContent, cardStyles }
}

export async function saveSiteConfig(input: { siteContent: SiteContent; cardStyles: CardStyles }) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		await writeSetting('site_content', input.siteContent)
		await writeSetting('card_styles', input.cardStyles)
		return
	}

	await writeJsonFile(FILES.siteContent, input.siteContent)
	await writeJsonFile(FILES.cardStyles, input.cardStyles)
}

export async function getAboutData() {
	return readSetting<AboutData>(
		'about_page',
		await readJsonFile<AboutData>(FILES.about, {
			title: '关于',
			description: '',
			content: ''
		})
	)
}

export async function saveAboutData(value: AboutData) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		await writeSetting('about_page', value)
		return
	}
	await writeJsonFile(FILES.about, value)
}

export async function getProjects() {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getProjectsFromD1(env.BLOG_DB)
		if (result) return result
	}

	return readSetting<Project[]>('projects_list', await readJsonFile<Project[]>(FILES.projects, []))
}

export async function saveProjects(items: Project[]) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveProjectsToD1(env.BLOG_DB, items)
		if (saved) return
		await writeSetting('projects_list', items)
		return
	}
	await writeJsonFile(FILES.projects, items)
}

export async function getShares() {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getSharesFromD1(env.BLOG_DB)
		if (result) return result
	}

	return readSetting<Share[]>('shares_list', await readJsonFile<Share[]>(FILES.shares, []))
}

export async function saveShares(items: Share[]) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveSharesToD1(env.BLOG_DB, items)
		if (saved) return
		await writeSetting('shares_list', items)
		return
	}
	await writeJsonFile(FILES.shares, items)
}

export async function getBloggers() {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getBloggersFromD1(env.BLOG_DB)
		if (result) return result
	}

	return readSetting<Blogger[]>('bloggers_list', await readJsonFile<Blogger[]>(FILES.bloggers, []))
}

export async function saveBloggers(items: Blogger[]) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveBloggersToD1(env.BLOG_DB, items)
		if (saved) return
		await writeSetting('bloggers_list', items)
		return
	}
	await writeJsonFile(FILES.bloggers, items)
}

export async function getSnippets() {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getSnippetsFromD1(env.BLOG_DB)
		if (result) return result
	}

	return readSetting<string[]>('snippets_list', await readJsonFile<string[]>(FILES.snippets, []))
}

export async function saveSnippets(items: string[]) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await saveSnippetsToD1(env.BLOG_DB, items)
		if (saved) return
		await writeSetting('snippets_list', items)
		return
	}
	await writeJsonFile(FILES.snippets, items)
}

export async function getPictures() {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const result = await getPicturesFromD1(env.BLOG_DB)
		if (result) return result
	}

	return readSetting<Picture[]>('pictures_list', await readJsonFile<Picture[]>(FILES.pictures, []))
}

export async function savePictures(items: Picture[]) {
	const env = await getContentBindings()
	if (env?.BLOG_DB) {
		const saved = await savePicturesToD1(env.BLOG_DB, items)
		if (saved) return
		await writeSetting('pictures_list', items)
		return
	}
	await writeJsonFile(FILES.pictures, items)
}
