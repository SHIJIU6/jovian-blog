import type { CategoriesConfig } from '@/hooks/use-categories'
import { getContentBindings } from './cloudflare'
import { getCategoriesFromAssets, getPostFromAssets, listPostsFromAssets } from './assets-source'
import { getCategoriesFromD1, getPostFromD1, listPostsFromD1 } from './d1-source'
import type { ContentListOptions, ContentPostDetail, ContentPostListItem } from './types'

async function importFileSource() {
	return import('./file-source')
}

export async function listContentPosts(options: ContentListOptions = {}): Promise<ContentPostListItem[]> {
	const env = await getContentBindings()

	if (env?.BLOG_DB) {
		const result = await listPostsFromD1(env.BLOG_DB, options)
		if (result) return result
	}

	if (env?.ASSETS?.fetch) {
		return listPostsFromAssets(env, options)
	}

	const fileSource = await importFileSource()
	return fileSource.listPostsFromFiles(options)
}

export async function getContentPost(slug: string, options: ContentListOptions = {}): Promise<ContentPostDetail | null> {
	const env = await getContentBindings()

	if (env?.BLOG_DB) {
		const result = await getPostFromD1(env.BLOG_DB, slug, options)
		if (result) return result
	}

	if (env?.ASSETS?.fetch) {
		return getPostFromAssets(env, slug, options)
	}

	const fileSource = await importFileSource()
	return fileSource.getPostFromFiles(slug, options)
}

export async function listContentCategories(): Promise<CategoriesConfig> {
	const env = await getContentBindings()

	if (env?.BLOG_DB) {
		const result = await getCategoriesFromD1(env.BLOG_DB)
		if (result) return result
	}

	if (env?.ASSETS?.fetch) {
		return getCategoriesFromAssets(env)
	}

	const fileSource = await importFileSource()
	return fileSource.getCategoriesFromFiles()
}
