import { create } from 'zustand'
import { defaultCardStyles, defaultSiteContent } from '@/config/default-content'

export type SiteMeta = {
	title: string
	description: string
	username: string
}

export type SiteTheme = {
	colorBrand: string
	colorPrimary: string
	colorSecondary: string
	colorBrandSecondary: string
	colorBg: string
	colorBorder: string
	colorCard: string
	colorArticle: string
}

export type SiteImageItem = {
	id: string
	url: string
}

export type SiteSocialButton = {
	id: string
	type: string
	value: string
	label: string
	order: number
}

export type SiteBeian = {
	text: string
	link: string
}

export type SiteContent = {
	meta: SiteMeta
	faviconUrl: string
	avatarUrl: string
	theme: SiteTheme
	backgroundColors: string[]
	artImages: SiteImageItem[]
	currentArtImageId: string
	backgroundImages: SiteImageItem[]
	currentBackgroundImageId: string
	socialButtons: SiteSocialButton[]
	clockShowSeconds: boolean
	summaryInContent: boolean
	enableHat: boolean
	hatOffsetX: number | null
	hatOffsetY: number | null
	hatScale: number | null
	isCachePem: boolean
	hideEditButton: boolean
	enableCategories: boolean
	currentHatIndex: number
	hatFlipped: boolean
	enableChristmas: boolean
	beian: SiteBeian
}

export type CardStyle = {
	width: number
	height: number
	offset?: number | null
	order: number
	offsetX: number | null
	offsetY: number | null
	enabled: boolean
}

export type CardStyles = Record<string, CardStyle>

interface ConfigStore {
	siteContent: SiteContent
	cardStyles: CardStyles
	regenerateKey: number
	configDialogOpen: boolean
	hydrated: boolean
	setSiteContent: (content: SiteContent) => void
	setCardStyles: (styles: CardStyles) => void
	hydrateFromRemote: (payload: { siteContent: SiteContent; cardStyles: CardStyles }) => void
	resetSiteContent: () => void
	resetCardStyles: () => void
	regenerateBubbles: () => void
	setConfigDialogOpen: (open: boolean) => void
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
	siteContent: { ...defaultSiteContent } as SiteContent,
	cardStyles: { ...defaultCardStyles } as CardStyles,
	regenerateKey: 0,
	configDialogOpen: false,
	hydrated: false,
	setSiteContent: (content: SiteContent) => {
		set({ siteContent: content })
	},
	setCardStyles: (styles: CardStyles) => {
		set({ cardStyles: styles })
	},
	hydrateFromRemote: payload => {
		set({
			siteContent: payload.siteContent,
			cardStyles: payload.cardStyles,
			hydrated: true
		})
	},
	resetSiteContent: () => {
		set({ siteContent: { ...defaultSiteContent } as SiteContent })
	},
	resetCardStyles: () => {
		set({ cardStyles: { ...defaultCardStyles } as CardStyles })
	},
	regenerateBubbles: () => {
		set(state => ({ regenerateKey: state.regenerateKey + 1 }))
	},
	setConfigDialogOpen: (open: boolean) => {
		set({ configDialogOpen: open })
	}
}))

