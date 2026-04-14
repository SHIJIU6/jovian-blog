'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import { HomeDraggableLayer } from './home-draggable-layer'
import { useSnippetsContent } from '@/hooks/use-structured-content'
import { cn } from '@/lib/utils'

const ROTATE_MS = 4000

export default function SnippetCard() {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const { data: snippets = [] } = useSnippetsContent()
	const styles = cardStyles.snippetCard
	const [index, setIndex] = useState(0)
	const compact = styles.width < 260 || styles.height < 130

	useEffect(() => {
		if (snippets.length <= 1) return
		const timer = window.setInterval(() => {
			setIndex(current => (current + 1) % snippets.length)
		}, ROTATE_MS)
		return () => window.clearInterval(timer)
	}, [snippets])

	useEffect(() => {
		if (index >= snippets.length) {
			setIndex(0)
		}
	}, [index, snippets.length])

	const currentSnippet = useMemo(() => snippets[index]?.content || snippets[0]?.content || '', [index, snippets])
	if (!currentSnippet) return null

	const x =
		styles.offsetX !== null
			? center.x + styles.offsetX
			: center.x + 350
	const y =
		styles.offsetY !== null
			? center.y + styles.offsetY
			: center.y - 325

	return (
		<HomeDraggableLayer cardKey='snippetCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='flex items-center overflow-hidden max-sm:static'>
				<p className={cn('w-full max-w-full text-sm leading-6 font-medium [overflow-wrap:anywhere]', compact ? 'line-clamp-2' : 'line-clamp-4')}>{currentSnippet}</p>
			</Card>
		</HomeDraggableLayer>
	)
}
