'use client'

import useSWR from 'swr'
import type { SiteContent, CardStyles } from '@/app/(home)/stores/config-store'
import type { AboutData } from '@/app/about/services/push-about'
import type { Project } from '@/app/projects/components/project-card'
import type { Share } from '@/app/share/components/share-card'
import type { Blogger } from '@/app/bloggers/grid-view'
import type { Picture } from '@/app/pictures/page'
import type { SnippetItem } from '@/lib/content-item-id'

const fetcher = async <T,>(url: string): Promise<T> => {
	const response = await fetch(url, { cache: 'no-store' })
	if (!response.ok) {
		throw new Error(`Fetch failed: ${response.status}`)
	}
	return response.json()
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
	return useSWR<Project[]>('/api/content/projects', fetcher, {
		revalidateOnFocus: false
	})
}

export function useSharesContent() {
	return useSWR<Share[]>('/api/content/shares', fetcher, {
		revalidateOnFocus: false
	})
}

export function useBloggersContent() {
	return useSWR<Blogger[]>('/api/content/bloggers', fetcher, {
		revalidateOnFocus: false
	})
}

export function useSnippetsContent() {
	return useSWR<SnippetItem[]>('/api/content/snippets', fetcher, {
		revalidateOnFocus: false
	})
}

export function usePicturesContent() {
	return useSWR<Picture[]>('/api/content/pictures', fetcher, {
		revalidateOnFocus: false
	})
}
