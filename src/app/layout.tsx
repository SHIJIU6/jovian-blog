import '@/styles/globals.css'

import type { Metadata } from 'next'
import Layout from '@/layout'
import Head from '@/layout/head'
import { getSiteConfig } from '@/lib/server/content/structured'

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
		'--color-brand': theme.colorBrand,
		'--color-primary': theme.colorPrimary,
		'--color-secondary': theme.colorSecondary,
		'--color-brand-secondary': theme.colorBrandSecondary,
		'--color-bg': theme.colorBg,
		'--color-border': theme.colorBorder,
		'--color-card': theme.colorCard,
		'--color-article': theme.colorArticle
	}

	return (
		<html lang='en' suppressHydrationWarning style={htmlStyle}>
			<Head faviconHref={faviconHref} />

			<body>
				<script
					dangerouslySetInnerHTML={{
						__html: `
					if (/windows|win32/i.test(navigator.userAgent)) {
						document.documentElement.classList.add('windows');
					}
		      `
					}}
				/>

				<Layout>{children}</Layout>
			</body>
		</html>
	)
}
