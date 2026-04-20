import '@/styles/globals.css'

import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Layout from '@/layout'
import Head from '@/layout/head'
import { getSiteConfig } from '@/lib/server/content/structured'
import { buildThemeBootScript, buildThemeCssVariables } from '@/lib/theme-mode'

export async function generateMetadata(): Promise<Metadata> {
	const { siteContent } = await getSiteConfig()
	const {
		meta: { title, description }
	} = siteContent

	return {
		title,
		description,
		openGraph: {
			title,
			description
		},
		twitter: {
			title,
			description
		}
	}
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const { siteContent } = await getSiteConfig()
	const { theme } = siteContent
	const faviconHref = siteContent.faviconUrl || '/favicon.png'
	const htmlStyle = {
		cursor: 'url(/images/cursor.svg) 2 1, auto',
		...buildThemeCssVariables(theme)
	} as CSSProperties

	return (
		<html lang='en' suppressHydrationWarning data-theme='light' style={htmlStyle}>
			<Head faviconHref={faviconHref} />

			<body>
				<script
					dangerouslySetInnerHTML={{
						__html: buildThemeBootScript()
					}}
				/>

				<Layout>{children}</Layout>
			</body>
		</html>
	)
}
