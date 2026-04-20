'use client'

import { motion } from 'motion/react'
import { LayoutPanelTop, MoonStar, SunMedium } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeMode } from '@/hooks/use-theme-mode'
import type { ThemeMode } from '@/lib/theme-mode'

const themeOptions: Array<{ mode: ThemeMode; label: string; shortLabel: string; icon: typeof SunMedium }> = [
	{ mode: 'light', label: '晴光', shortLabel: '晴', icon: SunMedium },
	{ mode: 'retro', label: '回廊', shortLabel: '廊', icon: LayoutPanelTop },
	{ mode: 'dark', label: '夜色', shortLabel: '夜', icon: MoonStar }
]

export default function ThemeToggle() {
	const { mode, mounted, setThemeMode } = useThemeMode()

	if (!mounted) {
		return null
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: -12, scale: 0.92 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			className='fixed top-3 right-4 z-40 flex items-center gap-1.5 rounded-full border p-1.5 max-sm:right-3'
			style={{
				background: 'var(--surface-soft)',
				borderColor: 'var(--surface-outline)',
				borderWidth: 'var(--control-border-width, 1px)',
				boxShadow: 'var(--dock-shadow)',
				backdropFilter: 'blur(var(--button-blur, 12px)) saturate(148%)',
				WebkitBackdropFilter: 'blur(var(--button-blur, 12px)) saturate(148%)'
			}}>
			{themeOptions.map(option => {
				const Icon = option.icon
				const active = mode === option.mode

				return (
					<motion.button
						key={option.mode}
						type='button'
						onClick={() => setThemeMode(option.mode)}
						whileHover={{ y: -1 }}
						whileTap={{ scale: 0.97 }}
						aria-pressed={active}
						aria-label={`切换到${option.label}主题`}
						title={`切换到${option.label}主题`}
						className={cn(
							'flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors max-sm:h-10 max-sm:w-10 max-sm:justify-center max-sm:px-0',
							active ? 'text-[var(--text-inverse)]' : 'text-primary'
						)}
						style={
							active
								? {
										background: 'var(--surface-contrast)',
										borderColor: 'color-mix(in srgb, var(--surface-outline) 64%, transparent)',
										borderWidth: 'var(--control-border-width, 1px)',
										boxShadow: 'var(--button-shadow)'
								  }
								: {
										background: 'transparent',
										borderColor: 'transparent',
										borderWidth: 'var(--control-border-width, 1px)'
								  }
						}>
						<Icon className='h-4 w-4 shrink-0' />
						<span className='max-sm:hidden'>{option.label}</span>
						<span className='hidden max-sm:inline'>{option.shortLabel}</span>
					</motion.button>
				)
			})}
		</motion.div>
	)
}
