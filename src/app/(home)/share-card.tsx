'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import Link from 'next/link'
import { HomeDraggableLayer } from './home-draggable-layer'
import { cn } from '@/lib/utils'
import { useSharesContent } from '@/hooks/use-structured-content'

type ShareItem = {
	name: string
	url: string
	logo: string
	description: string
	tags: string[]
	stars: number
}

export default function ShareCard() {
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const { data: shares = [] } = useSharesContent()
	const [randomItem, setRandomItem] = useState<ShareItem | null>(null)
	const styles = cardStyles.shareCard
	const hiCardStyles = cardStyles.hiCard
	const socialButtonsStyles = cardStyles.socialButtons
	const compact = styles.width < 290 || styles.height < 170

	useEffect(() => {
		if (shares.length === 0) {
			setRandomItem(null)
			return
		}
		const randomIndex = Math.floor(Math.random() * shares.length)
		setRandomItem(shares[randomIndex] as ShareItem)
	}, [shares])

	if (!randomItem) {
		return null
	}

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x + hiCardStyles.width / 2 - socialButtonsStyles.width
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 + CARD_SPACING + socialButtonsStyles.height + CARD_SPACING

	return (
		<HomeDraggableLayer cardKey='shareCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='overflow-hidden'>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-12.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 120, left: -12, top: -12, opacity: 0.8 }}
						/>
					</>
				)}

				<h2 className='text-secondary text-sm'>随机推荐</h2>

				<Link href='/share' className='mt-2 block min-w-0 space-y-2 overflow-hidden'>
					<div className='flex min-w-0 items-center gap-3'>
						<div className='relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-soft-strong)]'>
							{randomItem.logo ? <img src={randomItem.logo} alt={randomItem.name || '推荐资源'} className='h-full w-full object-contain' /> : <span className='text-[10px] text-secondary'>资源</span>}
						</div>
						<h3 className={cn('min-w-0 text-sm leading-5 font-medium [overflow-wrap:anywhere]', compact ? 'line-clamp-1' : 'line-clamp-2')}>{randomItem.name}</h3>
					</div>

					<p className={cn('text-secondary text-xs leading-5 [overflow-wrap:anywhere]', compact ? 'line-clamp-2' : 'line-clamp-3')}>{randomItem.description}</p>
				</Link>
			</Card>
		</HomeDraggableLayer>
	)
}
