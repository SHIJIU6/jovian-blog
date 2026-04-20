'use client'

import { useEffect, useState } from 'react'
import {
	DEFAULT_THEME_MODE,
	THEME_MODES,
	THEME_STORAGE_KEY,
	getThemeColorScheme,
	normalizeThemeMode,
	type ThemeMode
} from '@/lib/theme-mode'

function readThemeFromDocument(): ThemeMode {
	if (typeof document === 'undefined') {
		return DEFAULT_THEME_MODE
	}

	return normalizeThemeMode(document.documentElement.dataset.theme, DEFAULT_THEME_MODE)
}

function applyTheme(mode: ThemeMode, persist = true) {
	const root = document.documentElement
	root.dataset.theme = mode
	root.style.colorScheme = getThemeColorScheme(mode)

	if (persist) {
		window.localStorage.setItem(THEME_STORAGE_KEY, mode)
	}

	window.dispatchEvent(new CustomEvent<ThemeMode>('themechange', { detail: mode }))
}

export function useThemeMode() {
	const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE)
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
			const nextMode: ThemeMode = DEFAULT_THEME_MODE
			applyTheme(nextMode, false)
			setMode(nextMode)
		}
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== THEME_STORAGE_KEY) return
			const nextMode = normalizeThemeMode(event.newValue, DEFAULT_THEME_MODE)
			applyTheme(nextMode, false)
			setMode(nextMode)
		}
		const handleThemeChange = (event: Event) => {
			const customEvent = event as CustomEvent<ThemeMode>
			setMode(normalizeThemeMode(customEvent.detail, readThemeFromDocument()))
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

	const cycleTheme = () => {
		const index = THEME_MODES.indexOf(mode)
		const nextMode = THEME_MODES[(index + 1 + THEME_MODES.length) % THEME_MODES.length]
		setThemeMode(nextMode)
	}

	return {
		mode,
		isDark: mode === 'dark',
		isRetro: mode === 'retro',
		mounted,
		setThemeMode,
		toggleTheme: cycleTheme
	}
}
