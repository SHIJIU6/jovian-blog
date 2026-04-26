import type { Project } from '@/app/projects/components/project-card'
import type { Share } from '@/app/share/components/share-card'
import type { Blogger, BloggerStatus } from '@/app/bloggers/grid-view'
import type { Picture } from '@/app/pictures/page'
import type {
	CardStyle,
	CardStyles,
	SiteBeian,
	SiteContent,
	SiteImageItem,
	SiteMeta,
	SiteSocialButton,
	SiteTheme
} from '@/app/(home)/stores/config-store'
import type { AboutData } from '@/app/about/services/push-about'
import contentAuthoringContract from '@/lib/content-authoring-contract.json'
import {
	createContentItemId,
	ensureContentItemId,
	normalizeBloggerId,
	normalizeProjectId,
	normalizeShareId,
	type SnippetItem
} from '@/lib/content-item-id'
import { getContentBindings } from '../content/cloudflare'
import {
	getAboutData,
	getBloggers,
	getPictures,
	getProjects,
	getShares,
	getSiteConfig,
	getSnippets,
	saveAboutData,
	saveBloggers,
	savePictures,
	saveProjects,
	saveShares,
	saveSiteConfig,
	saveSnippets
} from '../content/structured'
import {
	deleteBloggerItemFromD1,
	deletePictureItemFromD1,
	deleteProjectItemFromD1,
	deleteShareItemFromD1,
	deleteSnippetItemFromD1,
	reorderBloggersInD1,
	reorderProjectsInD1,
	reorderSharesInD1,
	reorderSnippetsInD1,
	upsertBloggerItemToD1,
	upsertPictureItemToD1,
	upsertProjectItemToD1,
	upsertShareItemToD1,
	upsertSnippetItemToD1
} from '../content/structured-d1'
import { writeAuditLog } from './audit'

export const CONTENT_AUTHORING_MODULES = ['projects', 'shares', 'bloggers', 'pictures', 'snippets'] as const

export type ContentAuthoringModule = (typeof CONTENT_AUTHORING_MODULES)[number]
export type SiteConfigSection = 'meta' | 'theme' | 'images' | 'social-buttons' | 'preferences' | 'card-styles'

type ContentAuthoringMap = {
	projects: Project
	shares: Share
	bloggers: Blogger
	pictures: Picture
	snippets: SnippetItem
}

type ContentAuthoringDescriptor = {
	singular: string
	title: string
	labelField: string
	requiredFields: string[]
	searchFields: string[]
	mediaFields: string[]
	supportsPosition: boolean
}

type MutationAction = 'create' | 'update' | 'delete' | 'replace_all'
type ActorEmail = string | null | undefined

type ListOptions = {
	query?: string
	limit?: number
}

type ContentMutationResult<T> = {
	item: T
	position: number
	summary: {
		module: string
		action: MutationAction
		total: number
		position: number
	}
}

type ContentAuthoringDescriptorSource = ContentAuthoringDescriptor & Record<string, unknown>

const descriptorSource = contentAuthoringContract as Record<ContentAuthoringModule, ContentAuthoringDescriptorSource>

export const contentAuthoringModuleDescriptors: Record<ContentAuthoringModule, ContentAuthoringDescriptor> = Object.fromEntries(
	CONTENT_AUTHORING_MODULES.map(module => {
		const descriptor = descriptorSource[module]
		return [
			module,
			{
				singular: descriptor.singular,
				title: descriptor.title,
				labelField: descriptor.labelField,
				requiredFields: [...descriptor.requiredFields],
				searchFields: [...descriptor.searchFields],
				mediaFields: [...descriptor.mediaFields],
				supportsPosition: Boolean(descriptor.supportsPosition)
			}
		]
	})
) as Record<ContentAuthoringModule, ContentAuthoringDescriptor>

export function isContentAuthoringModule(value: string): value is ContentAuthoringModule {
	return CONTENT_AUTHORING_MODULES.includes(value as ContentAuthoringModule)
}

export class ContentAuthoringError extends Error {
	status: number

	constructor(message: string, status = 400) {
		super(message)
		this.name = 'ContentAuthoringError'
		this.status = status
	}
}

function hasOwn(value: Record<string, unknown>, key: string) {
	return Object.prototype.hasOwnProperty.call(value, key)
}

function asRecord(value: unknown) {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function normalizeString(value: unknown) {
	return typeof value === 'string' ? value.trim() : ''
}

function normalizeOptionalString(value: unknown) {
	const next = normalizeString(value)
	return next || undefined
}

function normalizeStringArray(value: unknown) {
	if (Array.isArray(value)) {
		return value.map(item => normalizeString(item)).filter(Boolean)
	}

	if (typeof value === 'string') {
		return value
			.split(',')
			.map(item => item.trim())
			.filter(Boolean)
	}

	return [] as string[]
}

function normalizeInteger(value: unknown, fallback: number, label: string, options?: { min?: number; max?: number }) {
	if (value === undefined || value === null || value === '') return fallback

	const parsed = typeof value === 'number' ? value : Number(String(value))
	if (!Number.isFinite(parsed)) {
		throw new ContentAuthoringError(`${label} 必须是数字`)
	}

	const rounded = Math.round(parsed)
	if (options?.min !== undefined && rounded < options.min) {
		throw new ContentAuthoringError(`${label} 不能小于 ${options.min}`)
	}
	if (options?.max !== undefined && rounded > options.max) {
		throw new ContentAuthoringError(`${label} 不能大于 ${options.max}`)
	}

	return rounded
}

function normalizeBoolean(value: unknown, fallback: boolean) {
	if (typeof value === 'boolean') return value
	if (value === 'true') return true
	if (value === 'false') return false
	return fallback
}

function normalizeNullableNumber(value: unknown, fallback: number | null) {
	if (value === undefined) return fallback
	if (value === null || value === '') return null

	const parsed = typeof value === 'number' ? value : Number(String(value))
	if (!Number.isFinite(parsed)) {
		throw new ContentAuthoringError('数值字段格式不正确')
	}
	return parsed
}

function requireNonEmpty(value: string, label: string) {
	if (!value) {
		throw new ContentAuthoringError(`${label} 不能为空`)
	}
}

function readStringField(source: Record<string, unknown>, key: string, fallback = '') {
	return hasOwn(source, key) ? normalizeString(source[key]) : fallback
}

function readOptionalStringField(source: Record<string, unknown>, key: string, fallback?: string) {
	return hasOwn(source, key) ? normalizeOptionalString(source[key]) : fallback
}

function readStringArrayField(source: Record<string, unknown>, key: string, fallback: string[] = []) {
	return hasOwn(source, key) ? normalizeStringArray(source[key]) : fallback
}

function readNumberField(source: Record<string, unknown>, key: string, fallback: number, label: string, options?: { min?: number; max?: number }) {
	return hasOwn(source, key) ? normalizeInteger(source[key], fallback, label, options) : fallback
}

function resolveInsertIndex(position: unknown, totalItems: number, defaultIndex = totalItems) {
	if (position === undefined || position === null || position === '') return Math.max(0, Math.min(defaultIndex, totalItems))
	const parsed = normalizeInteger(position, defaultIndex + 1, 'position', { min: 1 })
	return Math.max(0, Math.min(parsed - 1, totalItems))
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
	if (fromIndex === toIndex) return [...items]
	const next = [...items]
	const [item] = next.splice(fromIndex, 1)
	next.splice(toIndex, 0, item)
	return next
}

function buildModuleSummary(module: ContentAuthoringModule, action: MutationAction, total: number, position?: number) {
	return {
		module,
		action,
		total,
		position: position === undefined ? -1 : position + 1
	}
}

function getProjectSearchValues(item: Project) {
	return [item.name, item.description, item.url, ...(item.tags || [])]
}

function getShareSearchValues(item: Share) {
	return [item.name, item.description, item.url, ...(item.tags || [])]
}

function getBloggerSearchValues(item: Blogger) {
	return [item.name, item.description, item.url, item.status || '']
}

function getPictureSearchValues(item: Picture) {
	return [item.description || '', item.uploadedAt || '', ...(item.images || []), item.image || '']
}

function getSnippetSearchValues(item: SnippetItem) {
	return [item.content]
}

function filterItems<T>(items: T[], query: string, extractValues: (item: T) => string[]) {
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) return items

	return items.filter(item =>
		extractValues(item)
			.join(' ')
			.toLowerCase()
			.includes(normalizedQuery)
	)
}

function normalizeProjectInput(input: unknown, current?: Project): Project {
	const source = asRecord(input)
	const name = readStringField(source, 'name', current?.name || '')
	const image = readStringField(source, 'image', current?.image || '')
	const url = readStringField(source, 'url', current?.url || '')
	const description = readStringField(source, 'description', current?.description || '')
	const tags = readStringArrayField(source, 'tags', current?.tags || [])
	const year = readNumberField(source, 'year', current?.year || new Date().getFullYear(), 'year', { min: 0 })
	const github = readOptionalStringField(source, 'github', current?.github)
	const npm = readOptionalStringField(source, 'npm', current?.npm)
	const explicitId = readOptionalStringField(source, 'id', current?.id)
	const id = normalizeProjectId({ id: explicitId, name, url, description })

	return { id, name, year, image, url, description, tags, github, npm }
}

function normalizeShareInput(input: unknown, current?: Share): Share {
	const source = asRecord(input)
	const name = readStringField(source, 'name', current?.name || '')
	const logo = readStringField(source, 'logo', current?.logo || '')
	const url = readStringField(source, 'url', current?.url || '')
	const description = readStringField(source, 'description', current?.description || '')
	const tags = readStringArrayField(source, 'tags', current?.tags || [])
	const stars = readNumberField(source, 'stars', current?.stars || 0, 'stars', { min: 0, max: 5 })
	const explicitId = readOptionalStringField(source, 'id', current?.id)
	const id = normalizeShareId({ id: explicitId, name, url, description })

	return { id, name, logo, url, description, tags, stars }
}

function normalizeBloggerStatus(value: unknown, fallback?: BloggerStatus) {
	const normalized = normalizeOptionalString(value)
	if (!normalized) return fallback
	if (normalized !== 'recent' && normalized !== 'disconnected') {
		throw new ContentAuthoringError('status 仅支持 recent 或 disconnected')
	}
	return normalized
}

function normalizeBloggerInput(input: unknown, current?: Blogger): Blogger {
	const source = asRecord(input)
	const name = readStringField(source, 'name', current?.name || '')
	const avatar = readStringField(source, 'avatar', current?.avatar || '')
	const url = readStringField(source, 'url', current?.url || '')
	const description = readStringField(source, 'description', current?.description || '')
	const stars = readNumberField(source, 'stars', current?.stars || 0, 'stars', { min: 0, max: 5 })
	const status = hasOwn(source, 'status') ? normalizeBloggerStatus(source.status, current?.status) : current?.status
	const explicitId = readOptionalStringField(source, 'id', current?.id)
	const id = normalizeBloggerId({ id: explicitId, name, url, description })

	return { id, name, avatar, url, description, stars, status }
}

function normalizePictureInput(input: unknown, current?: Picture): Picture {
	const source = asRecord(input)
	const currentImages = Array.isArray(current?.images) && current.images.length > 0 ? current.images : current?.image ? [current.image] : []
	const explicitImages = hasOwn(source, 'images') ? normalizeStringArray(source.images) : currentImages
	const imageFallback = hasOwn(source, 'image') ? normalizeString(source.image) : current?.image || ''
	const normalizedImages = explicitImages.length > 0 ? explicitImages : imageFallback ? [imageFallback] : []
	const description = hasOwn(source, 'description') ? readOptionalStringField(source, 'description') : current?.description
	const uploadedAt = readStringField(source, 'uploadedAt', current?.uploadedAt || new Date().toISOString())
	const explicitId = readOptionalStringField(source, 'id', current?.id)
	const id = ensureContentItemId('picture', explicitId || current?.id, uploadedAt, normalizedImages[0] || description || 'empty')

	return {
		id,
		description,
		uploadedAt: uploadedAt || new Date().toISOString(),
		image: normalizedImages[0] || '',
		images: normalizedImages
	}
}

function normalizeSnippetInput(input: unknown, current?: SnippetItem): SnippetItem {
	const source = asRecord(input)
	const content = readStringField(source, 'content', current?.content || '')
	const explicitId = readOptionalStringField(source, 'id', current?.id)
	const id = current?.id || explicitId || createContentItemId('snippet')
	return { id, content }
}

async function listProjectsInternal(options?: ListOptions) {
	const items = await getProjects()
	const filtered = filterItems(items, options?.query || '', getProjectSearchValues)
	return typeof options?.limit === 'number' ? filtered.slice(0, Math.max(1, options.limit)) : filtered
}

async function listSharesInternal(options?: ListOptions) {
	const items = await getShares()
	const filtered = filterItems(items, options?.query || '', getShareSearchValues)
	return typeof options?.limit === 'number' ? filtered.slice(0, Math.max(1, options.limit)) : filtered
}

async function listBloggersInternal(options?: ListOptions) {
	const items = await getBloggers()
	const filtered = filterItems(items, options?.query || '', getBloggerSearchValues)
	return typeof options?.limit === 'number' ? filtered.slice(0, Math.max(1, options.limit)) : filtered
}

async function listPicturesInternal(options?: ListOptions) {
	const items = await getPictures()
	const filtered = filterItems(items, options?.query || '', getPictureSearchValues)
	return typeof options?.limit === 'number' ? filtered.slice(0, Math.max(1, options.limit)) : filtered
}

async function listSnippetsInternal(options?: ListOptions) {
	const items = await getSnippets()
	const filtered = filterItems(items, options?.query || '', getSnippetSearchValues)
	return typeof options?.limit === 'number' ? filtered.slice(0, Math.max(1, options.limit)) : filtered
}

async function listModuleItems<M extends ContentAuthoringModule>(module: M, options?: ListOptions): Promise<ContentAuthoringMap[M][]> {
	switch (module) {
		case 'projects':
			return (await listProjectsInternal(options)) as ContentAuthoringMap[M][]
		case 'shares':
			return (await listSharesInternal(options)) as ContentAuthoringMap[M][]
		case 'bloggers':
			return (await listBloggersInternal(options)) as ContentAuthoringMap[M][]
		case 'pictures':
			return (await listPicturesInternal(options)) as ContentAuthoringMap[M][]
		case 'snippets':
			return (await listSnippetsInternal(options)) as ContentAuthoringMap[M][]
		default:
			throw new ContentAuthoringError('不支持的内容模块', 404)
	}
}

async function replaceModuleItems<M extends ContentAuthoringModule>(module: M, items: ContentAuthoringMap[M][]) {
	switch (module) {
		case 'projects':
			await saveProjects(items as Project[])
			return
		case 'shares':
			await saveShares(items as Share[])
			return
		case 'bloggers':
			await saveBloggers(items as Blogger[])
			return
		case 'pictures':
			await savePictures(items as Picture[])
			return
		case 'snippets':
			await saveSnippets(items as SnippetItem[])
			return
		default:
			throw new ContentAuthoringError('不支持的内容模块', 404)
	}
}

async function persistItemMutationToD1<M extends ContentAuthoringModule>(
	module: M,
	nextItems: ContentAuthoringMap[M][],
	params:
		| { action: 'create' | 'update'; item: ContentAuthoringMap[M] }
		| {
				action: 'delete'
				id: string
		  }
) {
	const env = await getContentBindings()
	if (!env?.BLOG_DB) return false

	switch (module) {
		case 'projects': {
			const projectItems = nextItems as Project[]
			const projectId = params.action === 'delete' ? params.id : (params.item as Project).id
			const projectIndex = projectItems.findIndex(item => item.id === projectId)
			const persisted =
				params.action === 'delete'
					? await deleteProjectItemFromD1(env.BLOG_DB, params.id)
					: await upsertProjectItemToD1(env.BLOG_DB, params.item as Project, Math.max(projectIndex, 0))
			if (!persisted) return false
			return reorderProjectsInD1(env.BLOG_DB, projectItems.map(item => item.id))
		}

		case 'shares': {
			const shareItems = nextItems as Share[]
			const shareId = params.action === 'delete' ? params.id : (params.item as Share).id
			const shareIndex = shareItems.findIndex(item => item.id === shareId)
			const persisted =
				params.action === 'delete'
					? await deleteShareItemFromD1(env.BLOG_DB, params.id)
					: await upsertShareItemToD1(env.BLOG_DB, params.item as Share, Math.max(shareIndex, 0))
			if (!persisted) return false
			return reorderSharesInD1(env.BLOG_DB, shareItems.map(item => item.id))
		}

		case 'bloggers': {
			const bloggerItems = nextItems as Blogger[]
			const bloggerId = params.action === 'delete' ? params.id : (params.item as Blogger).id
			const bloggerIndex = bloggerItems.findIndex(item => item.id === bloggerId)
			const persisted =
				params.action === 'delete'
					? await deleteBloggerItemFromD1(env.BLOG_DB, params.id)
					: await upsertBloggerItemToD1(env.BLOG_DB, params.item as Blogger, Math.max(bloggerIndex, 0))
			if (!persisted) return false
			return reorderBloggersInD1(env.BLOG_DB, bloggerItems.map(item => item.id))
		}

		case 'snippets': {
			const snippetItems = nextItems as SnippetItem[]
			const snippetId = params.action === 'delete' ? params.id : (params.item as SnippetItem).id
			const snippetIndex = snippetItems.findIndex(item => item.id === snippetId)
			const persisted =
				params.action === 'delete'
					? await deleteSnippetItemFromD1(env.BLOG_DB, params.id)
					: await upsertSnippetItemToD1(env.BLOG_DB, params.item as SnippetItem, Math.max(snippetIndex, 0))
			if (!persisted) return false
			return reorderSnippetsInD1(env.BLOG_DB, snippetItems.map(item => item.id))
		}

		case 'pictures': {
			if (params.action === 'delete') {
				return deletePictureItemFromD1(env.BLOG_DB, params.id)
			}
			return upsertPictureItemToD1(env.BLOG_DB, params.item as Picture)
		}

		default:
			return false
	}
}

function normalizeModuleItem<M extends ContentAuthoringModule>(module: M, input: unknown, current?: ContentAuthoringMap[M]): ContentAuthoringMap[M] {
	switch (module) {
		case 'projects':
			return {
				...normalizeProjectInput(input, current as Project | undefined),
				...(current ? { id: getItemId(current) } : {})
			} as ContentAuthoringMap[M]
		case 'shares':
			return {
				...normalizeShareInput(input, current as Share | undefined),
				...(current ? { id: getItemId(current) } : {})
			} as ContentAuthoringMap[M]
		case 'bloggers':
			return {
				...normalizeBloggerInput(input, current as Blogger | undefined),
				...(current ? { id: getItemId(current) } : {})
			} as ContentAuthoringMap[M]
		case 'pictures':
			return {
				...normalizePictureInput(input, current as Picture | undefined),
				...(current ? { id: getItemId(current) } : {})
			} as ContentAuthoringMap[M]
		case 'snippets':
			return {
				...normalizeSnippetInput(input, current as SnippetItem | undefined),
				...(current ? { id: getItemId(current) } : {})
			} as ContentAuthoringMap[M]
		default:
			throw new ContentAuthoringError('不支持的内容模块', 404)
	}
}

function getItemId<M extends ContentAuthoringModule>(item: ContentAuthoringMap[M]) {
	return String((item as { id: string }).id || '')
}

async function writeModuleAuditLog<M extends ContentAuthoringModule>(
	module: M,
	action: MutationAction,
	actorEmail: ActorEmail,
	payload: Record<string, unknown>
) {
	await writeAuditLog({
		actorEmail: actorEmail || 'local-dev',
		action: `${module}.${action}`,
		targetType: module,
		targetId: typeof payload.id === 'string' ? payload.id : undefined,
		payload
	})
}

export async function listContentAuthoringItems<M extends ContentAuthoringModule>(module: M, options?: ListOptions) {
	const items = await listModuleItems(module, options)
	return {
		items,
		summary: {
			module,
			total: items.length,
			query: options?.query?.trim() || undefined
		}
	}
}

export async function getContentAuthoringItem<M extends ContentAuthoringModule>(module: M, id: string) {
	const normalizedId = normalizeString(id)
	if (!normalizedId) {
		throw new ContentAuthoringError('缺少 id')
	}

	const items = await listModuleItems(module)
	const index = items.findIndex(item => getItemId(item) === normalizedId)
	if (index === -1) {
		throw new ContentAuthoringError(`${contentAuthoringModuleDescriptors[module].singular} 不存在`, 404)
	}

	return {
		item: items[index],
		position: index + 1,
		summary: {
			module,
			total: items.length,
			position: index + 1
		}
	}
}

export async function createContentAuthoringItem<M extends ContentAuthoringModule>(
	module: M,
	input: unknown,
	actorEmail?: ActorEmail
): Promise<ContentMutationResult<ContentAuthoringMap[M]>> {
	const descriptor = contentAuthoringModuleDescriptors[module]
	const currentItems = await listModuleItems(module)
	const normalizedItem = normalizeModuleItem(module, input)
	const raw = asRecord(input)
	const insertIndex = descriptor.supportsPosition ? resolveInsertIndex(raw.position, currentItems.length, currentItems.length) : currentItems.length
	const nextItems = [...currentItems]
	nextItems.splice(insertIndex, 0, normalizedItem)

	const d1Persisted = await persistItemMutationToD1(module, nextItems, { action: 'create', item: normalizedItem })
	if (!d1Persisted) {
		await replaceModuleItems(module, nextItems)
	}

	await writeModuleAuditLog(module, 'create', actorEmail, {
		id: getItemId(normalizedItem),
		position: insertIndex + 1,
		total: nextItems.length
	})

	return {
		item: normalizedItem,
		position: insertIndex + 1,
		summary: buildModuleSummary(module, 'create', nextItems.length, insertIndex)
	}
}

export async function updateContentAuthoringItem<M extends ContentAuthoringModule>(
	module: M,
	id: string,
	input: unknown,
	actorEmail?: ActorEmail
): Promise<ContentMutationResult<ContentAuthoringMap[M]>> {
	const normalizedId = normalizeString(id)
	if (!normalizedId) {
		throw new ContentAuthoringError('缺少 id')
	}

	const descriptor = contentAuthoringModuleDescriptors[module]
	const currentItems = await listModuleItems(module)
	const currentIndex = currentItems.findIndex(item => getItemId(item) === normalizedId)
	if (currentIndex === -1) {
		throw new ContentAuthoringError(`${descriptor.singular} 不存在`, 404)
	}

	const currentItem = currentItems[currentIndex]
	const normalizedItem = normalizeModuleItem(module, input, currentItem)
	const baseItems = [...currentItems]
	baseItems[currentIndex] = normalizedItem
	const raw = asRecord(input)
	const targetIndex = descriptor.supportsPosition ? resolveInsertIndex(raw.position, baseItems.length, currentIndex) : currentIndex
	const nextItems = descriptor.supportsPosition ? moveItem(baseItems, currentIndex, targetIndex) : baseItems
	const nextIndex = nextItems.findIndex(item => getItemId(item) === getItemId(normalizedItem))

	const d1Persisted = await persistItemMutationToD1(module, nextItems, { action: 'update', item: normalizedItem })
	if (!d1Persisted) {
		await replaceModuleItems(module, nextItems)
	}

	await writeModuleAuditLog(module, 'update', actorEmail, {
		id: getItemId(normalizedItem),
		position: nextIndex + 1,
		total: nextItems.length
	})

	return {
		item: normalizedItem,
		position: nextIndex + 1,
		summary: buildModuleSummary(module, 'update', nextItems.length, nextIndex)
	}
}

export async function deleteContentAuthoringItem<M extends ContentAuthoringModule>(module: M, id: string, actorEmail?: ActorEmail) {
	const normalizedId = normalizeString(id)
	if (!normalizedId) {
		throw new ContentAuthoringError('缺少 id')
	}

	const descriptor = contentAuthoringModuleDescriptors[module]
	const currentItems = await listModuleItems(module)
	const currentIndex = currentItems.findIndex(item => getItemId(item) === normalizedId)
	if (currentIndex === -1) {
		throw new ContentAuthoringError(`${descriptor.singular} 不存在`, 404)
	}

	const removedItem = currentItems[currentIndex]
	const nextItems = currentItems.filter(item => getItemId(item) !== normalizedId)
	const d1Persisted = await persistItemMutationToD1(module, nextItems, { action: 'delete', id: normalizedId })
	if (!d1Persisted) {
		await replaceModuleItems(module, nextItems)
	}

	await writeModuleAuditLog(module, 'delete', actorEmail, {
		id: normalizedId,
		total: nextItems.length
	})

	return {
		id: normalizedId,
		item: removedItem,
		summary: buildModuleSummary(module, 'delete', nextItems.length, currentIndex)
	}
}

export async function replaceContentAuthoringItems<M extends ContentAuthoringModule>(module: M, items: unknown[], actorEmail?: ActorEmail) {
	const normalizedItems = items.map(item => normalizeModuleItem(module, item))
	await replaceModuleItems(module, normalizedItems)
	await writeModuleAuditLog(module, 'replace_all', actorEmail, {
		total: normalizedItems.length
	})
	return {
		items: normalizedItems,
		summary: buildModuleSummary(module, 'replace_all', normalizedItems.length)
	}
}

function normalizeSiteImageItems(value: unknown, kind: 'art' | 'background', fallback: SiteImageItem[]) {
	if (value === undefined) return fallback
	if (!Array.isArray(value)) {
		throw new ContentAuthoringError(`${kind}Images 必须是数组`)
	}

	return value
		.map(item => {
			const source = asRecord(item)
			const url = readStringField(source, 'url')
			if (kind !== 'background') requireNonEmpty(url, `${kind} image url`)
			return {
				id: readOptionalStringField(source, 'id') || createContentItemId(kind),
				url
			}
		})
		.filter(item => item.url)
}

function normalizeSocialButtons(value: unknown, fallback: SiteSocialButton[]) {
	if (value === undefined) return fallback
	if (!Array.isArray(value)) {
		throw new ContentAuthoringError('socialButtons 必须是数组')
	}

	return value.map((item, index) => {
		const source = asRecord(item)
		const type = readStringField(source, 'type')
		const valueField = readStringField(source, 'value')
		const label = readStringField(source, 'label', type)
		requireNonEmpty(type, 'social button type')
		requireNonEmpty(valueField, 'social button value')
		return {
			id: readOptionalStringField(source, 'id') || createContentItemId('social'),
			type,
			value: valueField,
			label: label || type,
			order: hasOwn(source, 'order') ? normalizeInteger(source.order, index, 'social button order', { min: 0 }) : index
		}
	})
}

function normalizeBackgroundColors(value: unknown, fallback: string[]) {
	if (value === undefined) return fallback
	const colors = normalizeStringArray(value)
	if (colors.length === 0) {
		throw new ContentAuthoringError('backgroundColors 至少需要一项')
	}
	return colors
}

function normalizeSiteMeta(value: unknown, fallback: SiteMeta): SiteMeta {
	const source = asRecord(value)
	return {
		title: readStringField(source, 'title', fallback.title),
		description: readStringField(source, 'description', fallback.description),
		username: readStringField(source, 'username', fallback.username)
	}
}

function normalizeSiteTheme(value: unknown, fallback: SiteTheme): SiteTheme {
	const source = asRecord(value)
	return {
		colorBrand: readStringField(source, 'colorBrand', fallback.colorBrand),
		colorPrimary: readStringField(source, 'colorPrimary', fallback.colorPrimary),
		colorSecondary: readStringField(source, 'colorSecondary', fallback.colorSecondary),
		colorBrandSecondary: readStringField(source, 'colorBrandSecondary', fallback.colorBrandSecondary),
		colorBg: readStringField(source, 'colorBg', fallback.colorBg),
		colorBorder: readStringField(source, 'colorBorder', fallback.colorBorder),
		colorCard: readStringField(source, 'colorCard', fallback.colorCard),
		colorArticle: readStringField(source, 'colorArticle', fallback.colorArticle)
	}
}

function normalizeSiteBeian(value: unknown, fallback: SiteBeian): SiteBeian {
	const source = asRecord(value)
	return {
		text: readStringField(source, 'text', fallback.text),
		link: readStringField(source, 'link', fallback.link)
	}
}

function normalizeCardStyles(value: unknown, fallback: CardStyles): CardStyles {
	const source = asRecord(value)
	const next: CardStyles = { ...fallback }

	for (const [key, rawStyle] of Object.entries(source)) {
		const styleSource = asRecord(rawStyle)
		const currentStyle = fallback[key] || {
			width: 0,
			height: 0,
			order: 0,
			offset: null,
			offsetX: null,
			offsetY: null,
			enabled: true
		}
		next[key] = {
			width: hasOwn(styleSource, 'width') ? normalizeInteger(styleSource.width, currentStyle.width, `${key}.width`) : currentStyle.width,
			height: hasOwn(styleSource, 'height') ? normalizeInteger(styleSource.height, currentStyle.height, `${key}.height`) : currentStyle.height,
			order: hasOwn(styleSource, 'order') ? normalizeInteger(styleSource.order, currentStyle.order, `${key}.order`) : currentStyle.order,
			offset: hasOwn(styleSource, 'offset') ? normalizeNullableNumber(styleSource.offset, currentStyle.offset ?? null) : currentStyle.offset ?? null,
			offsetX: hasOwn(styleSource, 'offsetX') ? normalizeNullableNumber(styleSource.offsetX, currentStyle.offsetX ?? null) : currentStyle.offsetX ?? null,
			offsetY: hasOwn(styleSource, 'offsetY') ? normalizeNullableNumber(styleSource.offsetY, currentStyle.offsetY ?? null) : currentStyle.offsetY ?? null,
			enabled: hasOwn(styleSource, 'enabled') ? normalizeBoolean(styleSource.enabled, currentStyle.enabled) : currentStyle.enabled
		} satisfies CardStyle
	}

	return next
}

export async function getAuthoringSiteConfig() {
	const config = await getSiteConfig()
	return {
		siteContent: config.siteContent,
		cardStyles: config.cardStyles,
		summary: {
			sections: ['meta', 'theme', 'images', 'social-buttons', 'preferences', 'card-styles']
		}
	}
}

export async function replaceAuthoringSiteConfig(input: unknown, actorEmail?: ActorEmail) {
	const config = await getSiteConfig()
	const source = asRecord(input)
	const siteSource = asRecord(source.siteContent)
	const siteContent: SiteContent = JSON.parse(JSON.stringify(config.siteContent))
	const cardStyles = normalizeCardStyles(source.cardStyles, config.cardStyles)

	siteContent.meta = normalizeSiteMeta(siteSource.meta, siteContent.meta)
	siteContent.theme = normalizeSiteTheme(siteSource.theme, siteContent.theme)
	siteContent.faviconUrl = readStringField(siteSource, 'faviconUrl', siteContent.faviconUrl)
	siteContent.avatarUrl = readStringField(siteSource, 'avatarUrl', siteContent.avatarUrl)
	siteContent.artImages = normalizeSiteImageItems(siteSource.artImages, 'art', siteContent.artImages || [])
	siteContent.currentArtImageId = readStringField(siteSource, 'currentArtImageId', siteContent.currentArtImageId || siteContent.artImages?.[0]?.id || '')
	siteContent.backgroundImages = normalizeSiteImageItems(siteSource.backgroundImages, 'background', siteContent.backgroundImages || [])
	siteContent.currentBackgroundImageId = readStringField(
		siteSource,
		'currentBackgroundImageId',
		siteContent.currentBackgroundImageId || siteContent.backgroundImages?.[0]?.id || ''
	)
	siteContent.socialButtons = normalizeSocialButtons(siteSource.socialButtons, siteContent.socialButtons || [])
	siteContent.backgroundColors = normalizeBackgroundColors(siteSource.backgroundColors, siteContent.backgroundColors || [])
	siteContent.clockShowSeconds = hasOwn(siteSource, 'clockShowSeconds') ? normalizeBoolean(siteSource.clockShowSeconds, siteContent.clockShowSeconds) : siteContent.clockShowSeconds
	siteContent.summaryInContent = hasOwn(siteSource, 'summaryInContent') ? normalizeBoolean(siteSource.summaryInContent, siteContent.summaryInContent) : siteContent.summaryInContent
	siteContent.enableHat = hasOwn(siteSource, 'enableHat') ? normalizeBoolean(siteSource.enableHat, siteContent.enableHat) : siteContent.enableHat
	siteContent.hatOffsetX = hasOwn(siteSource, 'hatOffsetX') ? normalizeNullableNumber(siteSource.hatOffsetX, siteContent.hatOffsetX) : siteContent.hatOffsetX
	siteContent.hatOffsetY = hasOwn(siteSource, 'hatOffsetY') ? normalizeNullableNumber(siteSource.hatOffsetY, siteContent.hatOffsetY) : siteContent.hatOffsetY
	siteContent.hatScale = hasOwn(siteSource, 'hatScale') ? normalizeNullableNumber(siteSource.hatScale, siteContent.hatScale) : siteContent.hatScale
	siteContent.isCachePem = hasOwn(siteSource, 'isCachePem') ? normalizeBoolean(siteSource.isCachePem, siteContent.isCachePem) : siteContent.isCachePem
	siteContent.hideEditButton = hasOwn(siteSource, 'hideEditButton') ? normalizeBoolean(siteSource.hideEditButton, siteContent.hideEditButton) : siteContent.hideEditButton
	siteContent.enableCategories = hasOwn(siteSource, 'enableCategories') ? normalizeBoolean(siteSource.enableCategories, siteContent.enableCategories) : siteContent.enableCategories
	siteContent.currentHatIndex = hasOwn(siteSource, 'currentHatIndex')
		? normalizeInteger(siteSource.currentHatIndex, siteContent.currentHatIndex, 'currentHatIndex', { min: 0 })
		: siteContent.currentHatIndex
	siteContent.hatFlipped = hasOwn(siteSource, 'hatFlipped') ? normalizeBoolean(siteSource.hatFlipped, siteContent.hatFlipped) : siteContent.hatFlipped
	siteContent.enableChristmas = hasOwn(siteSource, 'enableChristmas') ? normalizeBoolean(siteSource.enableChristmas, siteContent.enableChristmas) : siteContent.enableChristmas
	siteContent.beian = hasOwn(siteSource, 'beian') ? normalizeSiteBeian(siteSource.beian, siteContent.beian) : siteContent.beian

	if (!siteContent.artImages.some(item => item.id === siteContent.currentArtImageId)) {
		siteContent.currentArtImageId = siteContent.artImages[0]?.id || ''
	}
	if (!siteContent.backgroundImages.some(item => item.id === siteContent.currentBackgroundImageId)) {
		siteContent.currentBackgroundImageId = siteContent.backgroundImages[0]?.id || ''
	}

	await saveSiteConfig({ siteContent, cardStyles })
	await writeAuditLog({
		actorEmail: actorEmail || 'local-dev',
		action: 'site-config.replace_all',
		targetType: 'site_config',
		payload: {
			socialButtonCount: siteContent.socialButtons.length,
			artImageCount: siteContent.artImages.length,
			backgroundImageCount: siteContent.backgroundImages.length
		}
	})

	return {
		siteContent,
		cardStyles,
		summary: {
			sections: ['meta', 'theme', 'images', 'social-buttons', 'preferences', 'card-styles']
		}
	}
}

export async function updateAuthoringSiteConfigSection(section: SiteConfigSection, input: unknown, actorEmail?: ActorEmail) {
	const config = await getSiteConfig()
	const siteContent: SiteContent = JSON.parse(JSON.stringify(config.siteContent))
	let cardStyles: CardStyles = JSON.parse(JSON.stringify(config.cardStyles))
	const source = asRecord(input)

	switch (section) {
		case 'meta':
			siteContent.meta = normalizeSiteMeta(hasOwn(source, 'meta') ? source.meta : source, siteContent.meta)
			break

		case 'theme':
			siteContent.theme = normalizeSiteTheme(hasOwn(source, 'theme') ? source.theme : source, siteContent.theme)
			break

		case 'images': {
			const payload = hasOwn(source, 'images') ? asRecord(source.images) : source
			siteContent.faviconUrl = readStringField(payload, 'faviconUrl', siteContent.faviconUrl)
			siteContent.avatarUrl = readStringField(payload, 'avatarUrl', siteContent.avatarUrl)
			siteContent.artImages = normalizeSiteImageItems(payload.artImages, 'art', siteContent.artImages || [])
			siteContent.backgroundImages = normalizeSiteImageItems(payload.backgroundImages, 'background', siteContent.backgroundImages || [])
			siteContent.currentArtImageId = readStringField(payload, 'currentArtImageId', siteContent.currentArtImageId || siteContent.artImages?.[0]?.id || '')
			siteContent.currentBackgroundImageId = readStringField(
				payload,
				'currentBackgroundImageId',
				siteContent.currentBackgroundImageId || siteContent.backgroundImages?.[0]?.id || ''
			)

			if (!siteContent.artImages.some(item => item.id === siteContent.currentArtImageId)) {
				siteContent.currentArtImageId = siteContent.artImages[0]?.id || ''
			}
			if (!siteContent.backgroundImages.some(item => item.id === siteContent.currentBackgroundImageId)) {
				siteContent.currentBackgroundImageId = siteContent.backgroundImages[0]?.id || ''
			}
			break
		}

		case 'social-buttons':
			siteContent.socialButtons = normalizeSocialButtons(hasOwn(source, 'socialButtons') ? source.socialButtons : source, siteContent.socialButtons || [])
			break

		case 'preferences': {
			const payload = hasOwn(source, 'preferences') ? asRecord(source.preferences) : source
			siteContent.backgroundColors = normalizeBackgroundColors(payload.backgroundColors, siteContent.backgroundColors || [])
			siteContent.clockShowSeconds = hasOwn(payload, 'clockShowSeconds') ? normalizeBoolean(payload.clockShowSeconds, siteContent.clockShowSeconds) : siteContent.clockShowSeconds
			siteContent.summaryInContent = hasOwn(payload, 'summaryInContent') ? normalizeBoolean(payload.summaryInContent, siteContent.summaryInContent) : siteContent.summaryInContent
			siteContent.enableHat = hasOwn(payload, 'enableHat') ? normalizeBoolean(payload.enableHat, siteContent.enableHat) : siteContent.enableHat
			siteContent.hatOffsetX = hasOwn(payload, 'hatOffsetX') ? normalizeNullableNumber(payload.hatOffsetX, siteContent.hatOffsetX) : siteContent.hatOffsetX
			siteContent.hatOffsetY = hasOwn(payload, 'hatOffsetY') ? normalizeNullableNumber(payload.hatOffsetY, siteContent.hatOffsetY) : siteContent.hatOffsetY
			siteContent.hatScale = hasOwn(payload, 'hatScale') ? normalizeNullableNumber(payload.hatScale, siteContent.hatScale) : siteContent.hatScale
			siteContent.isCachePem = hasOwn(payload, 'isCachePem') ? normalizeBoolean(payload.isCachePem, siteContent.isCachePem) : siteContent.isCachePem
			siteContent.hideEditButton = hasOwn(payload, 'hideEditButton') ? normalizeBoolean(payload.hideEditButton, siteContent.hideEditButton) : siteContent.hideEditButton
			siteContent.enableCategories = hasOwn(payload, 'enableCategories') ? normalizeBoolean(payload.enableCategories, siteContent.enableCategories) : siteContent.enableCategories
			siteContent.currentHatIndex = hasOwn(payload, 'currentHatIndex')
				? normalizeInteger(payload.currentHatIndex, siteContent.currentHatIndex, 'currentHatIndex', { min: 0 })
				: siteContent.currentHatIndex
			siteContent.hatFlipped = hasOwn(payload, 'hatFlipped') ? normalizeBoolean(payload.hatFlipped, siteContent.hatFlipped) : siteContent.hatFlipped
			siteContent.enableChristmas = hasOwn(payload, 'enableChristmas') ? normalizeBoolean(payload.enableChristmas, siteContent.enableChristmas) : siteContent.enableChristmas
			siteContent.beian = hasOwn(payload, 'beian') ? normalizeSiteBeian(payload.beian, siteContent.beian) : siteContent.beian
			break
		}

		case 'card-styles':
			cardStyles = normalizeCardStyles(hasOwn(source, 'cardStyles') ? source.cardStyles : source, cardStyles)
			break

		default:
			throw new ContentAuthoringError('不支持的站点配置 section', 404)
	}

	await saveSiteConfig({ siteContent, cardStyles })
	await writeAuditLog({
		actorEmail: actorEmail || 'local-dev',
		action: `site-config.update_${section.replace(/-/g, '_')}`,
		targetType: 'site_config',
		targetId: section,
		payload: {
			section
		}
	})

	return {
		section,
		value:
			section === 'card-styles'
				? cardStyles
				: section === 'meta'
					? siteContent.meta
					: section === 'theme'
						? siteContent.theme
						: section === 'images'
							? {
									faviconUrl: siteContent.faviconUrl,
									avatarUrl: siteContent.avatarUrl,
									artImages: siteContent.artImages,
									currentArtImageId: siteContent.currentArtImageId,
									backgroundImages: siteContent.backgroundImages,
									currentBackgroundImageId: siteContent.currentBackgroundImageId
								}
							: section === 'social-buttons'
								? siteContent.socialButtons
								: {
										backgroundColors: siteContent.backgroundColors,
										clockShowSeconds: siteContent.clockShowSeconds,
										summaryInContent: siteContent.summaryInContent,
										enableHat: siteContent.enableHat,
										hatOffsetX: siteContent.hatOffsetX,
										hatOffsetY: siteContent.hatOffsetY,
										hatScale: siteContent.hatScale,
										isCachePem: siteContent.isCachePem,
										hideEditButton: siteContent.hideEditButton,
										enableCategories: siteContent.enableCategories,
										currentHatIndex: siteContent.currentHatIndex,
										hatFlipped: siteContent.hatFlipped,
										enableChristmas: siteContent.enableChristmas,
										beian: siteContent.beian
									},
		siteContent,
		cardStyles,
		summary: {
			section
		}
	}
}

export async function getAuthoringAboutPage() {
	const about = await getAboutData()
	return {
		about,
		summary: {
			title: about.title
		}
	}
}

export async function updateAuthoringAboutPage(input: unknown, actorEmail?: ActorEmail) {
	const current = await getAboutData()
	const source = asRecord(input)
	const about: AboutData = {
		title: readStringField(source, 'title', current.title),
		description: readStringField(source, 'description', current.description),
		content: readStringField(source, 'content', current.content)
	}

	await saveAboutData(about)
	await writeAuditLog({
		actorEmail: actorEmail || 'local-dev',
		action: 'about.update',
		targetType: 'about_page',
		payload: {
			title: about.title,
			contentLength: about.content.length
		}
	})

	return {
		about,
		summary: {
			title: about.title
		}
	}
}
