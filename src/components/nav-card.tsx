'use client'

import Card from '@/components/card'
import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useCenterStore } from '@/hooks/use-center'
import { CARD_SPACING } from '@/consts'
import ScrollOutlineSVG from '@/svgs/scroll-outline.svg'
import ScrollFilledSVG from '@/svgs/scroll-filled.svg'
import ProjectsFilledSVG from '@/svgs/projects-filled.svg'
import ProjectsOutlineSVG from '@/svgs/projects-outline.svg'
import AboutFilledSVG from '@/svgs/about-filled.svg'
import AboutOutlineSVG from '@/svgs/about-outline.svg'
import ShareFilledSVG from '@/svgs/share-filled.svg'
import ShareOutlineSVG from '@/svgs/share-outline.svg'
import WebsiteFilledSVG from '@/svgs/website-filled.svg'
import WebsiteOutlineSVG from '@/svgs/website-outline.svg'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { cn } from '@/lib/utils'
import { useSize } from '@/hooks/use-size'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { HomeDraggableLayer } from '@/app/(home)/home-draggable-layer'

const list = [
	{
		icon: ScrollOutlineSVG,
		iconActive: ScrollFilledSVG,
		label: '近期文章',
		href: '/blog'
	},
	{
		icon: ProjectsOutlineSVG,
		iconActive: ProjectsFilledSVG,
		label: '我的项目',
		href: '/projects'
	},
	{
		icon: AboutOutlineSVG,
		iconActive: AboutFilledSVG,
		label: '关于网站',
		href: '/about'
	},
	{
		icon: ShareOutlineSVG,
		iconActive: ShareFilledSVG,
		label: '推荐分享',
		href: '/share'
	},
	{
		icon: WebsiteOutlineSVG,
		iconActive: WebsiteFilledSVG,
		label: '优秀博客',
		href: '/bloggers'
	}
]

const extraSize = 8
const glassPillStyle = {
	background: 'linear-gradient(180deg, var(--surface-soft-strong) 0%, color-mix(in srgb, var(--surface-soft) 84%, transparent) 100%)',
	boxShadow: 'var(--button-shadow)',
	borderColor: 'var(--surface-outline)',
	borderWidth: 'var(--control-border-width, 1px)'
}

export default function NavCard() {
	const pathname = usePathname()
	const center = useCenterStore()
	const [show, setShow] = useState(false)
	const { maxSM } = useSize()
	const [hoveredIndex, setHoveredIndex] = useState<number>(0)
	const [highlightStyle, setHighlightStyle] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
	const { siteContent, cardStyles } = useConfigStore()
	const avatarSrc = siteContent.avatarUrl || '/images/avatar.png'
	const styles = cardStyles.navCard
	const hiCardStyles = cardStyles.hiCard
	const listRef = useRef<HTMLDivElement | null>(null)
	const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})

	const activeIndex = useMemo(() => {
		const index = list.findIndex(item => pathname === item.href)
		return index >= 0 ? index : undefined
	}, [pathname])

	useEffect(() => {
		setShow(true)
	}, [])

	let form = useMemo(() => {
		if (pathname == '/') return 'full'
		else if (pathname == '/write') return 'mini'
		else return 'compact'
	}, [pathname])
	if (maxSM) form = 'icons'

	let position = useMemo(() => {
		if (form === 'full') {
			const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - hiCardStyles.width / 2 - styles.width - CARD_SPACING
			const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 - styles.height
			return { x, y }
		}

		return {
			x: 24,
			y: 16
		}
	}, [form, center, styles, hiCardStyles])

	const size = useMemo(() => {
		if (form === 'mini') return { width: 64, height: 64 }
		else if (form === 'icons') return { width: 340, height: 64 }
		else if (form === 'compact') return { width: 620, height: 64 }
		else return { width: styles.width, height: styles.height }
	}, [form, styles])

	useEffect(() => {
		if (form === 'compact' && activeIndex !== undefined && hoveredIndex !== activeIndex) {
			setHoveredIndex(activeIndex)
			return
		}

		if (form === 'icons' && activeIndex !== undefined && hoveredIndex !== activeIndex) {
			const timer = setTimeout(() => {
				setHoveredIndex(activeIndex)
			}, 1500)
			return () => clearTimeout(timer)
		}
	}, [hoveredIndex, activeIndex, form])

	const updateHighlightStyle = useCallback(() => {
		if (form !== 'icons') {
			setHighlightStyle(null)
			return
		}

		const container = listRef.current
		const target = list[hoveredIndex] ? itemRefs.current[list[hoveredIndex].href] : null
		if (!container || !target) return

		const containerRect = container.getBoundingClientRect()
		const targetRect = target.getBoundingClientRect()
		const inset = form === 'icons' ? extraSize : 0

		setHighlightStyle({
			top: targetRect.top - containerRect.top - inset,
			left: targetRect.left - containerRect.left - inset,
			width: targetRect.width + inset * 2,
			height: targetRect.height + inset * 2
		})
	}, [form, hoveredIndex])

	useLayoutEffect(() => {
		if (!show) return
		updateHighlightStyle()
	}, [show, updateHighlightStyle])

	useEffect(() => {
		const onResize = () => updateHighlightStyle()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [updateHighlightStyle])

	if (maxSM) position = { x: center.x - size.width / 2, y: 16 }

	if (show)
		return (
			<HomeDraggableLayer cardKey='navCard' x={position.x} y={position.y} width={size.width} height={size.height}>
				<Card
					order={styles.order}
					width={size.width}
					height={size.height}
					x={position.x}
					y={position.y}
					className={clsx(
						form != 'full' && 'overflow-hidden',
						form === 'mini' && 'p-3',
						form === 'icons' && 'flex items-center gap-6 p-3',
						form === 'compact' && 'flex items-center gap-3 px-3 py-2'
					)}>
					{form === 'full' && siteContent.enableChristmas && (
						<>
							<img
								src='/images/christmas/snow-4.webp'
								alt='Christmas decoration'
								className='pointer-events-none absolute'
								style={{ width: 160, left: -18, top: -20, opacity: 0.9 }}
							/>
						</>
					)}

					<Link className={cn('flex items-center gap-3', form === 'compact' && 'gap-2')} href='/'>
						<img
							src={avatarSrc}
							alt='avatar'
							width={form === 'compact' ? 32 : 40}
							height={form === 'compact' ? 32 : 40}
							style={{ boxShadow: 'var(--image-shadow)' }}
							className='rounded-full object-cover'
						/>
						{form === 'full' && (
							<span className='font-averia mt-1 max-w-[11rem] min-w-0 text-2xl leading-tight font-medium [overflow-wrap:anywhere]'>{siteContent.meta.title}</span>
						)}
						{form === 'compact' && <span className='font-averia max-w-[140px] min-w-0 truncate text-lg leading-none font-medium'>{siteContent.meta.title}</span>}
					</Link>

					{(form === 'full' || form === 'icons' || form === 'compact') && (
						<>
							{form === 'full' && <div className='text-secondary mt-6 text-sm uppercase'>General</div>}

							<div ref={listRef} className={cn('relative mt-2 space-y-2', form === 'icons' && 'mt-0 flex items-center gap-6 space-y-0', form === 'compact' && 'mt-0 flex items-center gap-1.5 space-y-0')}>
								{form === 'icons' && highlightStyle && (
									<motion.div
										className='absolute rounded-full border'
										layoutId='nav-hover'
										initial={false}
										animate={highlightStyle}
										transition={{
											type: 'spring',
											stiffness: 400,
											damping: 30
										}}
										style={glassPillStyle}
									/>
								)}

								{list.map((item, index) => {
									const emphasized = form === 'full' ? index === hoveredIndex : form === 'compact' ? index === hoveredIndex || activeIndex === index : false

									return (
										<Link
											key={item.href}
											ref={element => {
												itemRefs.current[item.href] = element
											}}
											href={item.href}
											className={cn(
												'text-secondary text-md relative z-10 flex items-center gap-3 rounded-full px-5 py-3 transition-all',
												form === 'icons' ? 'p-0' : 'w-full',
												form === 'compact' && 'w-auto gap-2 border border-transparent px-2.5 py-1.5 text-[13px] whitespace-nowrap hover:bg-[var(--surface-hover)]',
												form === 'full' &&
													(index === hoveredIndex ? 'border' : 'border border-transparent hover:bg-[var(--surface-hover)]')
											)}
											style={emphasized ? glassPillStyle : undefined}
											onMouseEnter={() => setHoveredIndex(index)}>
											<div className={cn('flex h-7 w-7 items-center justify-center', form === 'compact' && 'h-5 w-5')}>
												{hoveredIndex == index ? (
													<item.iconActive className={cn('text-brand absolute h-7 w-7', form === 'compact' && 'h-5 w-5')} />
												) : (
													<item.icon className={cn('absolute h-7 w-7', form === 'compact' && 'h-5 w-5')} />
												)}
											</div>
											{form !== 'icons' && (
												<span
													className={clsx(
														'min-w-0 [overflow-wrap:anywhere]',
														form === 'compact' && 'truncate',
														(index == hoveredIndex || activeIndex === index) && 'text-primary font-medium'
													)}>
													{item.label}
												</span>
											)}
										</Link>
									)
								})}
							</div>
						</>
					)}
				</Card>
			</HomeDraggableLayer>
		)
}
