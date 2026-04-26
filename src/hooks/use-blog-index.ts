import { useMemo } from 'react'
import useSWRInfinite from 'swr/infinite'
import type { BlogIndexItem } from '@/app/blog/types'
import { useManagementMode } from './use-management-mode'
import type { PaginatedResponse } from '@/lib/pagination'

export type { BlogIndexItem } from '@/app/blog/types'

// 改进 fetcher，抛出状态码以便处理 404
const fetcher = async (url: string): Promise<PaginatedResponse<BlogIndexItem>> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}
	const data = await res.json()
	if (Array.isArray(data)) {
		return { items: data, page: 1, pageSize: data.length, hasMore: false }
	}
	return {
		items: Array.isArray(data?.items) ? data.items : [],
		page: Number(data?.page || 1),
		pageSize: Number(data?.pageSize || 24),
		hasMore: Boolean(data?.hasMore)
	}
}

export function useBlogIndex() {
	const canManage = useManagementMode()
	const pageSize = 24
	const { data, error, isLoading, size, setSize } = useSWRInfinite<PaginatedResponse<BlogIndexItem>>(
		(pageIndex, previousPageData) => {
			if (previousPageData && !previousPageData.hasMore) return null
			const search = new URLSearchParams({ page: String(pageIndex + 1), pageSize: String(pageSize) })
			if (canManage) search.set('includeHidden', 'true')
			return `/api/content/posts?${search.toString()}`
		},
		fetcher,
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: true,
			revalidateFirstPage: false
		}
	)

	const pages = data || []
	let result = useMemo(() => pages.flatMap(page => page.items), [pages])
	if (!canManage) {
		result = result.filter(item => !item.hidden)
	}
	const lastPage = pages[pages.length - 1]

	return {
		items: result,
		loading: isLoading,
		error,
		isLoadingMore: isLoading || (size > 0 && Boolean(data) && typeof data?.[size - 1] === 'undefined'),
		hasMore: Boolean(lastPage?.hasMore),
		loadMore: () => setSize(size + 1)
	}
}

export function useLatestBlog() {
	const { items, loading, error } = useBlogIndex()

	const latestBlog = items.length > 0 ? items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null

	return {
		blog: latestBlog,
		loading,
		error
	}
}
