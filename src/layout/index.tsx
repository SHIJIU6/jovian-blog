'use client'
import { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { useCenterInit } from '@/hooks/use-center'
import BlurredBubblesBackground from './backgrounds/blurred-bubbles'
import NavCard from '@/components/nav-card'
import { Toaster } from 'sonner'
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { useSize, useSizeInit } from '@/hooks/use-size'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { ScrollTopButton } from '@/components/scroll-top-button'
import MusicCard from '@/components/music-card'
import ThemeToggle from '@/components/theme-toggle'
import { usePathname } from 'next/navigation'
import { useSiteConfigContent } from '@/hooks/use-structured-content'
import { useThemeMode } from '@/hooks/use-theme-mode'
import { resolveThemeBackgroundColors } from '@/lib/theme-mode'

export default function Layout({ children }: PropsWithChildren) {
	useCenterInit()
	useSizeInit()
	const { cardStyles, siteContent, regenerateKey, hydrateFromRemote } = useConfigStore()
	const { maxSM, init } = useSize()
	const pathname = usePathname()
	const isStudio = pathname.startsWith('/studio')
	const { mode, mounted } = useThemeMode()
	const { data } = useSiteConfigContent()

	useEffect(() => {
		if (data) {
			hydrateFromRemote(data)
		}
	}, [data, hydrateFromRemote])

	const backgroundImages = (siteContent.backgroundImages ?? []) as Array<{ id: string; url: string }>
	const currentBackgroundImageId = siteContent.currentBackgroundImageId
	const currentBackgroundImage =
		currentBackgroundImageId && currentBackgroundImageId.trim() ? backgroundImages.find(item => item.id === currentBackgroundImageId) : null
	const themedBackgroundColors = resolveThemeBackgroundColors(siteContent.backgroundColors, siteContent.theme, mode)

	return (
		<>
			<Toaster
				position='bottom-right'
				richColors
				icons={{
					success: <CircleCheckIcon className='size-4' />,
					info: <InfoIcon className='size-4' />,
					warning: <TriangleAlertIcon className='size-4' />,
					error: <OctagonXIcon className='size-4' />,
					loading: <Loader2Icon className='size-4 animate-spin' />
				}}
				style={
					{
						'--border-radius': '12px'
					} as React.CSSProperties
				}
			/>
			{currentBackgroundImage && (
				<div
					className='fixed inset-0 z-0 overflow-hidden'
					style={{
						backgroundImage: `url(${currentBackgroundImage.url})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat'
					}}
				/>
			)}
			{mounted && mode !== 'retro' && <BlurredBubblesBackground colors={themedBackgroundColors} regenerateKey={regenerateKey} />}

			<main className='relative z-10 h-full'>
				{children}
				{!isStudio && <ThemeToggle />}
				{!isStudio && <NavCard />}

				{!isStudio && !maxSM && cardStyles.musicCard?.enabled !== false && <MusicCard />}
			</main>

			{maxSM && init && <ScrollTopButton className='bg-brand/20 fixed right-6 bottom-8 z-50 shadow-md' />}
		</>
	)
}
