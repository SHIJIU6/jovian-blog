'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import { HomeDraggableLayer } from './home-draggable-layer'
import { useSnippetsContent } from '@/hooks/use-structured-content'

const ROTATE_MS = 4000

export default function SnippetCard() {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const { data: snippets = [] } = useSnippetsContent()
	const styles = cardStyles.snippetCard
	const hiCardStyles = cardStyles.hiCard
	const clockCardStyles = cardStyles.clockCard
	const writeButtonsStyles = cardStyles.writeButtons
	const [index, setIndex] = useState(0)

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

	const currentSnippet = useMemo(() => snippets[index] || snippets[0] || '', [index, snippets])
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
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='flex items-center max-sm:static'>
				<p className='line-clamp-3 text-sm leading-6 font-medium'>{currentSnippet}</p>
			</Card>
		</HomeDraggableLayer>
	)
}
