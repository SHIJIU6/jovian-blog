import { useCenterStore } from '@/hooks/use-center'
import Card from '@/components/card'
import { useConfigStore } from './stores/config-store'
import { HomeDraggableLayer } from './home-draggable-layer'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function getGreeting() {
	const hour = new Date().getHours()

	if (hour >= 6 && hour < 12) {
		return 'Good Morning'
	} else if (hour >= 12 && hour < 18) {
		return 'Good Afternoon'
	} else if (hour >= 18 && hour < 22) {
		return 'Good Evening'
	} else {
		return 'Good Night'
	}
}

export default function HiCard() {
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const greeting = getGreeting()
	const styles = cardStyles.hiCard
	const username = siteContent.meta.username || 'Your Name'
	const avatarSrc = siteContent.avatarUrl || '/images/avatar.png'
	const hatIndex = siteContent.currentHatIndex ?? 1
	const hatFlipped = siteContent.hatFlipped ?? false
	const showHat = siteContent.enableHat ?? true
	const hatOffsetX = siteContent.hatOffsetX ?? 50
	const hatOffsetY = siteContent.hatOffsetY ?? -30
	const hatScale = siteContent.hatScale ?? 0.9
	const avatarSize = Math.max(84, Math.min(120, Math.round(Math.min(styles.width * 0.32, styles.height * 0.42))))
	const scaledHatOffsetX = (hatOffsetX / 120) * avatarSize
	const scaledHatOffsetY = (hatOffsetY / 120) * avatarSize
	const compact = styles.width < 360 || styles.height < 240

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - styles.width / 2
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y - styles.height / 2

	return (
		<HomeDraggableLayer cardKey='hiCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='relative flex flex-col items-center justify-center overflow-hidden text-center max-sm:static max-sm:translate-0'>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-1.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 180, left: -20, top: -25, opacity: 0.9 }}
						/>
						<img
							src='/images/christmas/snow-2.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 160, bottom: -12, right: -8, opacity: 0.9 }}
						/>
					</>
				)}
				<Link href='/about' className='relative mx-auto block shrink-0' style={{ height: avatarSize, width: avatarSize }}>
					<div className='relative overflow-visible' style={{ height: avatarSize, width: avatarSize }}>
						<img
							src={avatarSrc}
							className='rounded-full object-cover'
							style={{ height: avatarSize, width: avatarSize, boxShadow: '0 16px 32px -5px #E2D9CE' }}
						/>
						{showHat && (
							<div
								className='pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 overflow-hidden'
								style={{
									height: avatarSize * 0.52,
									width: avatarSize * 0.8,
									top: scaledHatOffsetY,
									marginLeft: scaledHatOffsetX,
									transform: `translateX(-50%) scale(${hatScale})`,
									transformOrigin: 'top center'
								}}>
								<img
									src={`/images/hats/${hatIndex}.webp`}
									alt='avatar hat'
									className='h-full w-full object-contain'
									style={{
										transform: hatFlipped ? 'scaleX(-1)' : 'none',
										transformOrigin: 'center'
									}}
								/>
							</div>
						)}
					</div>
				</Link>
				<h1 className={cn('font-averia mt-4 max-w-full px-3 leading-tight', compact ? 'text-xl' : 'text-2xl')}>
					<span className='block'>{greeting}</span>
					<span className='mt-2 block'>
						I'm{' '}
						<span className={cn('text-linear inline-block max-w-full align-bottom [overflow-wrap:anywhere]', compact ? 'text-[28px]' : 'text-[32px]')}>{username}</span>
						, Nice to
					</span>
					<span className='mt-1 block'>meet you!</span>
				</h1>
			</Card>
		</HomeDraggableLayer>
	)
}
