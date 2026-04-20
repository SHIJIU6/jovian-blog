'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { CARD_SPACING } from '@/consts'
import MusicSVG from '@/svgs/music.svg'
import PlaySVG from '@/svgs/play.svg'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import { Pause } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { toast } from 'sonner'

type MusicTrack = {
	name: string
	url: string
	source: 'env' | 'public' | 'local' | 'r2'
}

export default function MusicCard() {
	const pathname = usePathname()
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const styles = cardStyles.musicCard
	const hiCardStyles = cardStyles.hiCard
	const clockCardStyles = cardStyles.clockCard
	const calendarCardStyles = cardStyles.calendarCard

	const [isPlaying, setIsPlaying] = useState(false)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [progress, setProgress] = useState(0)
	const [tracks, setTracks] = useState<MusicTrack[]>([])
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const currentIndexRef = useRef(0)
	const trackUrls = useMemo(() => tracks.map(track => track.url), [tracks])

	const isHomePage = pathname === '/'

	useEffect(() => {
		let cancelled = false

		async function loadTracks() {
			try {
				const res = await fetch('/api/music', { cache: 'no-store' })
				if (!res.ok) return
				const data = await res.json().catch(() => ({}))
				if (!cancelled) {
					const nextTracks = Array.isArray(data?.tracks) ? data.tracks : []
					setTracks(nextTracks)
				}
			} catch {
				// Ignore fetch failures and leave the card hidden.
			}
		}

		void loadTracks()

		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		if (trackUrls.length === 0) {
			setIsPlaying(false)
			setCurrentIndex(0)
			currentIndexRef.current = 0
			return
		}

		if (currentIndex >= trackUrls.length) {
			setCurrentIndex(0)
			currentIndexRef.current = 0
		}
	}, [currentIndex, trackUrls.length])

	const position = useMemo(() => {
		// If not on home page, always position at bottom-right corner when playing
		if (!isHomePage) {
			return {
				x: center.width - styles.width - 16,
				y: center.height - styles.height - 16
			}
		}

		// Default position on home page
		return {
			x: styles.offsetX !== null ? center.x + styles.offsetX : center.x + CARD_SPACING + hiCardStyles.width / 2 - (styles.offset ?? 0),
			y:
				styles.offsetY !== null
					? center.y + styles.offsetY
					: center.y - (clockCardStyles.offset ?? 0) + CARD_SPACING + calendarCardStyles.height + CARD_SPACING
		}
	}, [isPlaying, isHomePage, center, styles, hiCardStyles, clockCardStyles, calendarCardStyles])

	const { x, y } = position

	// Initialize audio element
	useEffect(() => {
		if (!audioRef.current) {
			audioRef.current = new Audio()
		}

		const audio = audioRef.current

		const updateProgress = () => {
			if (audio.duration) {
				setProgress((audio.currentTime / audio.duration) * 100)
			}
		}

		const handleEnded = () => {
			if (trackUrls.length === 0) return
			const nextIndex = (currentIndexRef.current + 1) % trackUrls.length
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
			setProgress(0)
		}

		const handleError = () => {
			if (trackUrls.length === 0) return
			if (trackUrls.length <= 1) {
				setIsPlaying(false)
				toast.error('当前背景音乐无法播放')
				return
			}

			const nextIndex = (currentIndexRef.current + 1) % trackUrls.length
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
			setProgress(0)
			toast.warning(`音频加载失败，已切换到下一首：${tracks[nextIndex]?.name || '未知音频'}`)
		}

		const handleTimeUpdate = () => {
			updateProgress()
		}

		const handleLoadedMetadata = () => {
			updateProgress()
		}

		audio.addEventListener('timeupdate', handleTimeUpdate)
		audio.addEventListener('ended', handleEnded)
		audio.addEventListener('loadedmetadata', handleLoadedMetadata)
		audio.addEventListener('error', handleError)

		return () => {
			audio.removeEventListener('timeupdate', handleTimeUpdate)
			audio.removeEventListener('ended', handleEnded)
			audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
			audio.removeEventListener('error', handleError)
		}
	}, [trackUrls.length, tracks])

	// Handle currentIndex change - load new audio
	useEffect(() => {
		if (trackUrls.length === 0) return

		currentIndexRef.current = currentIndex
		if (audioRef.current) {
			const wasPlaying = !audioRef.current.paused
			audioRef.current.pause()
			audioRef.current.src = trackUrls[currentIndex]
			audioRef.current.loop = false
			setProgress(0)

			if (wasPlaying) {
				audioRef.current.play().catch(console.error)
			}
		}
	}, [currentIndex, trackUrls])

	// Handle play/pause state change
	useEffect(() => {
		if (!audioRef.current) return

		if (isPlaying) {
			audioRef.current.play().catch(console.error)
		} else {
			audioRef.current.pause()
		}
	}, [isPlaying])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.src = ''
			}
		}
	}, [])

	const togglePlayPause = () => {
		setIsPlaying(!isPlaying)
	}

	if (trackUrls.length === 0) {
		return null
	}

	// Hide component if not on home page and not playing
	if (!isHomePage && !isPlaying) {
		return null
	}

	return (
		<HomeDraggableLayer cardKey='musicCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className={clsx('flex min-w-0 items-center gap-3 overflow-hidden', !isHomePage && 'fixed')}>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-10.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 120, left: -8, top: -12, opacity: 0.8 }}
						/>
						<img
							src='/images/christmas/snow-11.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 80, right: -10, top: -12, opacity: 0.8 }}
						/>
					</>
				)}

				<MusicSVG className='h-8 w-8' />

				<div className='min-w-0 flex-1'>
					<div className='text-secondary truncate text-sm'>{tracks[currentIndex]?.name || '背景音乐'}</div>

					<div className='mt-1 h-2 rounded-full bg-[var(--surface-soft-strong)]'>
						<div className='bg-linear h-full rounded-full transition-all duration-300' style={{ width: `${progress}%` }} />
					</div>
				</div>

				<button onClick={togglePlayPause} className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft-strong)] transition-opacity hover:opacity-80'>
					{isPlaying ? <Pause className='text-brand h-4 w-4' /> : <PlaySVG className='text-brand ml-1 h-4 w-4' />}
				</button>
			</Card>
		</HomeDraggableLayer>
	)
}
