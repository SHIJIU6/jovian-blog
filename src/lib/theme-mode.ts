import { clamp, hexToRgb, rgbToHex } from '@/lib/color'
import type { SiteTheme } from '@/app/(home)/stores/config-store'

export type ThemeMode = 'light' | 'retro' | 'dark'

export const THEME_STORAGE_KEY = '2025-blog-theme-mode'
export const THEME_MODES: ThemeMode[] = ['light', 'retro', 'dark']
export const DEFAULT_THEME_MODE: ThemeMode = 'retro'

export function isThemeMode(value: unknown): value is ThemeMode {
	return value === 'light' || value === 'retro' || value === 'dark'
}

export function normalizeThemeMode(value: unknown, fallback: ThemeMode = DEFAULT_THEME_MODE): ThemeMode {
	return isThemeMode(value) ? value : fallback
}

export function getThemeColorScheme(mode: ThemeMode): 'light' | 'dark' {
	return mode === 'dark' ? 'dark' : 'light'
}

function stripAlpha(hex: string) {
	const cleaned = hex.trim()
	if (!cleaned.startsWith('#')) return cleaned
	if (cleaned.length === 9) return cleaned.slice(0, 7)
	if (cleaned.length === 5) {
		const [r, g, b] = cleaned
			.slice(1)
			.split('')
			.map(char => `${char}${char}`)
		return `#${r}${g}${b}`
	}
	return cleaned
}

function mixColor(colorA: string, colorB: string, amount = 0.5) {
	const ratio = clamp(amount, 0, 1)
	const a = hexToRgb(stripAlpha(colorA))
	const b = hexToRgb(stripAlpha(colorB))

	return rgbToHex(a.r + (b.r - a.r) * ratio, a.g + (b.g - a.g) * ratio, a.b + (b.b - a.b) * ratio)
}

function withAlpha(color: string, alpha: number) {
	const rgb = hexToRgb(stripAlpha(color))
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`
}

export function createDarkTheme(theme: SiteTheme): SiteTheme {
	const brand = mixColor('#66ece4', theme.colorBrand, 0.08)
	const brandSecondary = mixColor('#8cc6ff', theme.colorBrandSecondary, 0.08)
	const darkBackground = '#081722'

	return {
		colorBrand: brand,
		colorPrimary: '#f8fbff',
		colorSecondary: withAlpha('#ecf6ff', 0.74),
		colorBrandSecondary: brandSecondary,
		colorBg: darkBackground,
		colorBorder: withAlpha('#ffffff', 0.14),
		colorCard: 'rgba(20, 35, 45, 0.85)',
		colorArticle: 'rgba(25, 40, 50, 0.88)'
	}
}

export function createRetroTheme(theme: SiteTheme): SiteTheme {
	return {
		colorBrand: mixColor('#ff8c37', theme.colorBrand, 0.16),
		colorPrimary: '#2c2217',
		colorSecondary: withAlpha('#2c2217', 0.7),
		colorBrandSecondary: mixColor('#8fdce8', theme.colorBrandSecondary, 0.22),
		colorBg: '#f8efc8',
		colorBorder: '#261d14',
		colorCard: '#fff7df',
		colorArticle: '#fff9ea'
	}
}

export function resolveThemeBackgroundColors(backgroundColors: string[], theme: SiteTheme, mode: ThemeMode) {
	if (mode === 'light') {
		return backgroundColors
	}

	if (mode === 'dark') {
		return [
			withAlpha(mixColor('#5ce7dd', theme.colorBrand, 0.12), 0.14),
			withAlpha('#50d8b1', 0.12),
			withAlpha('#63bcff', 0.13),
			withAlpha('#7aa9ff', 0.1),
			withAlpha('#7ddcf5', 0.1),
			withAlpha('#8de7d1', 0.09)
		]
	}

	return [
		withAlpha('#ffbe68', 0.1),
		withAlpha('#9be0eb', 0.08),
		withAlpha('#d3f279', 0.08),
		withAlpha('#ffd98f', 0.1)
	]
}

export function buildThemeCssVariables(theme: SiteTheme) {
	const darkTheme = createDarkTheme(theme)
	const retroTheme = createRetroTheme(theme)

	const lightGlowStrong = withAlpha(mixColor(theme.colorBrandSecondary, theme.colorBrand, 0.28), 0.22)
	const lightGlowSoft = withAlpha(mixColor(theme.colorBrand, '#ffffff', 0.6), 0.18)

	return {
		'--light-color-brand': theme.colorBrand,
		'--light-color-primary': theme.colorPrimary,
		'--light-color-secondary': theme.colorSecondary,
		'--light-color-brand-secondary': theme.colorBrandSecondary,
		'--light-color-bg': theme.colorBg,
		'--light-color-border': theme.colorBorder,
		'--light-color-card': theme.colorCard,
		'--light-color-article': theme.colorArticle,
		'--dark-color-brand': darkTheme.colorBrand,
		'--dark-color-primary': darkTheme.colorPrimary,
		'--dark-color-secondary': darkTheme.colorSecondary,
		'--dark-color-brand-secondary': darkTheme.colorBrandSecondary,
		'--dark-color-bg': darkTheme.colorBg,
		'--dark-color-border': darkTheme.colorBorder,
		'--dark-color-card': darkTheme.colorCard,
		'--dark-color-article': darkTheme.colorArticle,
		'--retro-color-brand': retroTheme.colorBrand,
		'--retro-color-primary': retroTheme.colorPrimary,
		'--retro-color-secondary': retroTheme.colorSecondary,
		'--retro-color-brand-secondary': retroTheme.colorBrandSecondary,
		'--retro-color-bg': retroTheme.colorBg,
		'--retro-color-border': retroTheme.colorBorder,
		'--retro-color-card': retroTheme.colorCard,
		'--retro-color-article': retroTheme.colorArticle,
		'--light-bg-top': mixColor(theme.colorBg, '#ffffff', 0.58),
		'--light-bg-mid': mixColor(theme.colorBg, '#f3f4f6', 0.34),
		'--light-bg-bottom': mixColor(theme.colorBg, theme.colorBrandSecondary, 0.08),
		'--dark-bg-top': '#000000',
		'--dark-bg-mid': '#030712',
		'--dark-bg-bottom': '#000000',
		'--retro-bg-top': '#ffe8a8',
		'--retro-bg-mid': '#f8efc8',
		'--retro-bg-bottom': '#f2dfaa',
		'--light-glow-strong': lightGlowStrong,
		'--light-glow-soft': lightGlowSoft,
		'--light-glow-tertiary': withAlpha(mixColor(theme.colorBrand, theme.colorBrandSecondary, 0.48), 0.12),
		'--dark-glow-strong': withAlpha('#8b5cf6', 0.13),
		'--dark-glow-soft': withAlpha('#3b82f6', 0.10),
		'--dark-glow-tertiary': withAlpha('#d946ef', 0.08),
		'--dark-aurora-magenta': withAlpha('#ec4899', 0.07),
		'--dark-aurora-warm': withAlpha('#60a5fa', 0.05),
		'--dark-vignette-top': 'rgba(0, 0, 0, 0.85)',
		'--dark-vignette-bottom': 'rgba(0, 0, 0, 0.92)',
		'--retro-glow-strong': withAlpha('#ffb960', 0.14),
		'--retro-glow-soft': withAlpha('#98e1eb', 0.1),
		'--retro-glow-tertiary': withAlpha('#d3f07d', 0.08),
		'--light-shadow-elevated': withAlpha(mixColor(theme.colorPrimary, '#0f172a', 0.18), 0.18),
		'--dark-shadow-elevated': 'rgba(3, 12, 24, 0.48)',
		'--retro-shadow-elevated': 'rgba(33, 24, 14, 0.94)',
		'--light-image-shadow': `0 22px 44px -18px ${withAlpha(mixColor(theme.colorBrandSecondary, theme.colorBrand, 0.34), 0.3)}`,
		'--dark-image-shadow': `0 20px 46px -20px ${withAlpha('#071521', 0.44)}`,
		'--retro-image-shadow': `6px 6px 0 ${withAlpha('#261d14', 0.92)}`,
		'--light-dock-shadow': `0 22px 42px -22px ${withAlpha(mixColor(theme.colorBrandSecondary, '#e8794a', 0.35), 0.3)}`,
		'--dark-dock-shadow': `0 18px 38px -18px ${withAlpha('#071521', 0.4)}`,
		'--retro-dock-shadow': `5px 5px 0 ${withAlpha('#261d14', 0.92)}`,
		'--light-code-button-bg': 'rgba(255, 255, 255, 0.92)',
		'--dark-code-button-bg': 'rgba(12, 27, 38, 0.82)',
		'--retro-code-button-bg': '#ffe9b5',
		'--light-code-button-border': 'rgba(0, 0, 0, 0.08)',
		'--dark-code-button-border': 'rgba(255, 255, 255, 0.12)',
		'--retro-code-button-border': '#261d14'
	} as Record<string, string>
}

export function buildThemeBootScript() {
	return `
		(function () {
			try {
				var key = '${THEME_STORAGE_KEY}';
				var stored = window.localStorage.getItem(key);
				var theme = stored === 'light' || stored === 'retro' || stored === 'dark'
					? stored
					: '${DEFAULT_THEME_MODE}';
				var colorScheme = theme === 'dark' ? 'dark' : 'light';

				document.documentElement.dataset.theme = theme;
				document.documentElement.style.colorScheme = colorScheme;

				if (/windows|win32/i.test(navigator.userAgent)) {
					document.documentElement.classList.add('windows');
				}
			} catch (error) {
				document.documentElement.dataset.theme = '${DEFAULT_THEME_MODE}';
				document.documentElement.style.colorScheme = 'light';
			}
		})();
	`
}
