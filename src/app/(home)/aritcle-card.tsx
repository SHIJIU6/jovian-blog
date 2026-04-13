import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useLatestBlog } from '@/hooks/use-blog-index'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import dayjs from 'dayjs'
import Link from 'next/link'
import { HomeDraggableLayer } from './home-draggable-layer'
import { cn } from '@/lib/utils'

export default function ArticleCard() {
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const { blog, loading } = useLatestBlog()
	const styles = cardStyles.articleCard
	const hiCardStyles = cardStyles.hiCard
	const socialButtonsStyles = cardStyles.socialButtons
	const compact = styles.width < 300 || styles.height < 170

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x + hiCardStyles.width / 2 - socialButtonsStyles.width - CARD_SPACING - styles.width
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 + CARD_SPACING

	return (
		<HomeDraggableLayer cardKey='articleCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='space-y-2 overflow-hidden max-sm:static'>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-9.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 140, left: -12, top: -16, opacity: 0.8 }}
						/>
					</>
				)}

				<h2 className='text-secondary text-sm'>最新文章</h2>

				{loading ? (
					<div className='flex h-[60px] items-center justify-center'>
						<span className='text-secondary text-xs'>加载中...</span>
					</div>
				) : blog ? (
					<Link href={`/blog/${blog.slug}`} className='flex min-w-0 items-start gap-3 overflow-hidden transition-opacity hover:opacity-80'>
						{blog.cover ? (
							<img src={blog.cover} alt='cover' className='h-12 w-12 shrink-0 rounded-xl border object-cover' />
						) : (
							<div className='text-secondary grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/60'>+</div>
						)}
						<div className='min-w-0 flex-1 overflow-hidden'>
							<h3 className={cn('text-sm leading-5 font-medium [overflow-wrap:anywhere]', compact ? 'line-clamp-1' : 'line-clamp-2')}>
								{blog.title || blog.slug}
							</h3>
							{blog.summary && (
								<p className={cn('text-secondary mt-1 text-xs leading-5 [overflow-wrap:anywhere]', compact ? 'line-clamp-1' : 'line-clamp-2')}>
									{blog.summary}
								</p>
							)}
							<p className='text-secondary mt-2 text-xs [overflow-wrap:anywhere]'>{dayjs(blog.date).format('YYYY/M/D')}</p>
						</div>
					</Link>
				) : (
					<div className='flex h-[60px] items-center justify-center'>
						<span className='text-secondary text-xs'>暂无文章</span>
					</div>
				)}
			</Card>
		</HomeDraggableLayer>
	)
}
