import { useCenterStore } from '@/hooks/use-center'
import Card from '@/components/card'
import { useConfigStore } from './stores/config-store'
import { HomeDraggableLayer } from './home-draggable-layer'
import Link from 'next/link'

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

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x - styles.width / 2
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y - styles.height / 2

	return (
		<HomeDraggableLayer cardKey='hiCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='relative text-center max-sm:static max-sm:translate-0'>
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
				<Link href='/about' className='relative mx-auto block h-[120px] w-[120px]'>
					<div className='relative h-[120px] w-[120px] overflow-visible'>
						<img
							src={avatarSrc}
							className='h-[120px] w-[120px] rounded-full object-cover'
							style={{ boxShadow: ' 0 16px 32px -5px #E2D9CE' }}
						/>
					{showHat && (
							<div
								className='pointer-events-none absolute left-1/2 top-0 z-10 h-[62px] w-[96px] -translate-x-1/2 overflow-hidden'
								style={{
									top: hatOffsetY,
									marginLeft: hatOffsetX,
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
				<h1 className='font-averia mt-3 text-2xl'>
					{greeting} <br /> I'm <span className='text-linear text-[32px]'>{username}</span> , Nice to <br /> meet you!
				</h1>
			</Card>
		</HomeDraggableLayer>
	)
}
