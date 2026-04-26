export const DEFAULT_PAGE_SIZE = 24
export const MAX_PAGE_SIZE = 100

export type PaginationParams = {
	page: number
	pageSize: number
	offset: number
	limit: number
}

export type PaginatedResponse<T> = {
	items: T[]
	page: number
	pageSize: number
	total?: number
	hasMore: boolean
}

export function normalizePagination(input: { page?: unknown; pageSize?: unknown; limit?: unknown }, defaults?: { pageSize?: number; maxPageSize?: number }): PaginationParams {
	const maxPageSize = defaults?.maxPageSize || MAX_PAGE_SIZE
	const fallbackPageSize = defaults?.pageSize || DEFAULT_PAGE_SIZE
	const rawPage = Number(input.page || 1)
	const rawPageSize = Number(input.pageSize || input.limit || fallbackPageSize)
	const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
	const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), maxPageSize) : fallbackPageSize
	return {
		page,
		pageSize,
		limit: pageSize,
		offset: (page - 1) * pageSize
	}
}

export function paginateArray<T>(items: T[], params: PaginationParams): PaginatedResponse<T> {
	const pageItems = items.slice(params.offset, params.offset + params.pageSize)
	return {
		items: pageItems,
		page: params.page,
		pageSize: params.pageSize,
		total: items.length,
		hasMore: params.offset + pageItems.length < items.length
	}
}
