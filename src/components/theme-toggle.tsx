'use client'

import { AnimatePresence, motion } from 'motion/react'
import { MoonStar, SunMedium } from 'lucide-react'
import { useThemeMode } from '@/hooks/use-theme-mode'

export default function ThemeToggle() {
	const { isDark, mounted, toggleTheme } = useThemeMode()

	if (!mounted) {
		return null
	}

	return (
		<motion.button
			type='button'
			onClick={toggleTheme}
			initial={{ opacity: 0, y: -12, scale: 0.92 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			whileHover={{ scale: 1.03 }}
			whileTap={{ scale: 0.97 }}
			aria-label={isDark ? '切换到浅色主题' : '切换到暗色主题'}
			title={isDark ? '切换到浅色主题' : '切换到暗色主题'}
			className='fixed top-[5.5rem] right-6 z-40 flex min-w-[148px] items-center gap-3 rounded-full border px-2 py-2 max-sm:top-[5.5rem] max-sm:right-4 max-sm:min-w-0'
			style={{
				background: 'var(--surface-soft)',
				borderColor: 'var(--surface-outline)',
				boxShadow: 'var(--dock-shadow)',
				backdropFilter: 'blur(22px) saturate(150%)',
				WebkitBackdropFilter: 'blur(22px) saturate(150%)'
			}}>
			<span
				className='flex h-11 w-11 items-center justify-center rounded-full'
				style={{
					background: 'var(--surface-contrast)',
					color: 'var(--text-inverse)',
					boxShadow: 'var(--dock-shadow)'
				}}>
				<AnimatePresence mode='wait' initial={false}>
					{isDark ? (
						<motion.span key='dark' initial={{ opacity: 0, rotate: 18, scale: 0.72 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: -18, scale: 0.72 }}>
							<MoonStar className='h-5 w-5' />
						</motion.span>
					) : (
						<motion.span key='light' initial={{ opacity: 0, rotate: -18, scale: 0.72 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 18, scale: 0.72 }}>
							<SunMedium className='h-5 w-5' />
						</motion.span>
					)}
				</AnimatePresence>
			</span>

			<span className='pr-2 text-left max-sm:hidden'>
				<span className='block text-[10px] uppercase tracking-[0.34em]' style={{ color: 'var(--text-faint)' }}>
					Theme
				</span>
				<span className='font-averia block text-sm leading-tight'>{isDark ? '夜色' : '晴光'}</span>
			</span>
		</motion.button>
	)
}
