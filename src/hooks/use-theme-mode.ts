'use client'

import { useEffect, useState } from 'react'
import { THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme-mode'

function readThemeFromDocument(): ThemeMode {
	if (typeof document === 'undefined') {
		return 'light'
	}

	return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode, persist = true) {
	const root = document.documentElement
	root.dataset.theme = mode
	root.style.colorScheme = mode

	if (persist) {
		window.localStorage.setItem(THEME_STORAGE_KEY, mode)
	}

	window.dispatchEvent(new CustomEvent('themechange', { detail: mode }))
}

export function useThemeMode() {
	const [mode, setMode] = useState<ThemeMode>('light')
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		const sync = () => {
			setMode(readThemeFromDocument())
		}

		sync()
		setMounted(true)

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		const handleMediaChange = () => {
			if (window.localStorage.getItem(THEME_STORAGE_KEY)) return
			const nextMode: ThemeMode = mediaQuery.matches ? 'dark' : 'light'
			applyTheme(nextMode, false)
			setMode(nextMode)
		}
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== THEME_STORAGE_KEY) return
			const nextMode: ThemeMode = event.newValue === 'dark' ? 'dark' : 'light'
			applyTheme(nextMode, false)
			setMode(nextMode)
		}
		const handleThemeChange = () => {
			sync()
		}

		mediaQuery.addEventListener('change', handleMediaChange)
		window.addEventListener('storage', handleStorage)
		window.addEventListener('themechange', handleThemeChange)

		return () => {
			mediaQuery.removeEventListener('change', handleMediaChange)
			window.removeEventListener('storage', handleStorage)
			window.removeEventListener('themechange', handleThemeChange)
		}
	}, [])

	const setThemeMode = (nextMode: ThemeMode) => {
		applyTheme(nextMode)
		setMode(nextMode)
	}

	return {
		mode,
		isDark: mode === 'dark',
		mounted,
		setThemeMode,
		toggleTheme: () => setThemeMode(mode === 'dark' ? 'light' : 'dark')
	}
}
