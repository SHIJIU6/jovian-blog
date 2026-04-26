'use client'

import { useMemo } from 'react'
import useSWRInfinite from 'swr/infinite'
import useSWR from 'swr'
import type { SiteContent, CardStyles } from '@/app/(home)/stores/config-store'
import type { AboutData } from '@/app/about/services/push-about'
import type { Project } from '@/app/projects/components/project-card'
import type { Share } from '@/app/share/components/share-card'
import type { Blogger } from '@/app/bloggers/grid-view'
import type { Picture } from '@/app/pictures/page'
import type { SnippetItem } from '@/lib/content-item-id'
import type { PaginatedResponse } from '@/lib/pagination'

const fetcher = async <T,>(url: string): Promise<T> => {
	const response = await fetch(url, { cache: 'no-store' })
	if (!response.ok) {
		throw new Error(`Fetch failed: ${response.status}`)
	}
	return response.json()
}

function normalizePage<T>(data: unknown): PaginatedResponse<T> {
	if (Array.isArray(data)) {
		return { items: data as T[], page: 1, pageSize: data.length, hasMore: false }
	}
	const page = data as Partial<PaginatedResponse<T>>
	return {
		items: Array.isArray(page?.items) ? page.items : [],
		page: Number(page?.page || 1),
		pageSize: Number(page?.pageSize || 24),
		total: page?.total,
		hasMore: Boolean(page?.hasMore)
	}
}

function usePaginatedContent<T>(baseUrl: string, pageSize = 24) {
	const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite<PaginatedResponse<T>>(
		(pageIndex, previousPageData) => {
			if (previousPageData && !previousPageData.hasMore) return null
			return `${baseUrl}?page=${pageIndex + 1}&pageSize=${pageSize}`
		},
		async url => normalizePage<T>(await fetcher<unknown>(url)),
		{ revalidateOnFocus: false, revalidateFirstPage: false }
	)

	const pages = data || []
	const items = useMemo(() => pages.flatMap(page => page.items), [pages])
	const lastPage = pages[pages.length - 1]

	return {
		data: items,
		items,
		pages,
		error,
		isLoading,
		isLoadingMore: isLoading || (size > 0 && Boolean(data) && typeof data?.[size - 1] === 'undefined'),
		hasMore: Boolean(lastPage?.hasMore),
		loadMore: () => setSize(size + 1),
		mutate: async (itemsOrUpdater?: T[] | ((items: T[]) => T[]), options?: { revalidate?: boolean }) => {
			if (typeof itemsOrUpdater === 'undefined') return mutate()
			const currentItems = pages.flatMap(page => page.items)
			const nextItems = typeof itemsOrUpdater === 'function' ? itemsOrUpdater(currentItems) : itemsOrUpdater
			return mutate([{ items: nextItems, page: 1, pageSize: nextItems.length, hasMore: false }], options)
		}
	}
}

export function useSiteConfigContent() {
	return useSWR<{ siteContent: SiteContent; cardStyles: CardStyles }>('/api/content/site-config', fetcher, {
		revalidateOnFocus: false
	})
}

export function useAboutContent() {
	return useSWR<AboutData>('/api/content/about', fetcher, {
		revalidateOnFocus: false
	})
}

export function useProjectsContent() {
	return usePaginatedContent<Project>('/api/content/projects')
}

export function useSharesContent() {
	return usePaginatedContent<Share>('/api/content/shares')
}

export function useBloggersContent() {
	return usePaginatedContent<Blogger>('/api/content/bloggers')
}

export function useSnippetsContent() {
	return usePaginatedContent<SnippetItem>('/api/content/snippets')
}

export function usePicturesContent() {
	return usePaginatedContent<Picture>('/api/content/pictures', 18)
}
