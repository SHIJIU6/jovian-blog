import { clamp, hexToRgb, rgbToHex } from '@/lib/color'
import type { SiteTheme } from '@/app/(home)/stores/config-store'

export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = '2025-blog-theme-mode'

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
		colorCard: withAlpha('#ffffff', 0.07),
		colorArticle: withAlpha('#ffffff', 0.09)
	}
}

export function resolveThemeBackgroundColors(backgroundColors: string[], theme: SiteTheme, mode: ThemeMode) {
	if (mode === 'light') {
		return backgroundColors
	}

	return [
		withAlpha(mixColor('#5ce7dd', theme.colorBrand, 0.12), 0.14),
		withAlpha('#50d8b1', 0.12),
		withAlpha('#63bcff', 0.13),
		withAlpha('#7aa9ff', 0.1),
		withAlpha('#7ddcf5', 0.1),
		withAlpha('#8de7d1', 0.09)
	]
}

export function buildThemeCssVariables(theme: SiteTheme) {
	const darkTheme = createDarkTheme(theme)

	const lightGlowStrong = withAlpha(mixColor(theme.colorBrandSecondary, theme.colorBrand, 0.28), 0.22)
	const lightGlowSoft = withAlpha(mixColor(theme.colorBrand, '#ffffff', 0.6), 0.18)
	const darkGlowStrong = withAlpha(mixColor(darkTheme.colorBrand, '#5ca9ff', 0.28), 0.28)
	const darkGlowSoft = withAlpha(mixColor(darkTheme.colorBrandSecondary, '#70d8ff', 0.38), 0.18)

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
		'--light-bg-top': mixColor(theme.colorBg, '#ffffff', 0.58),
		'--light-bg-mid': mixColor(theme.colorBg, '#f3f4f6', 0.34),
		'--light-bg-bottom': mixColor(theme.colorBg, theme.colorBrandSecondary, 0.08),
		'--dark-bg-top': '#0b2030',
		'--dark-bg-mid': '#102a39',
		'--dark-bg-bottom': '#07131d',
		'--light-glow-strong': lightGlowStrong,
		'--light-glow-soft': lightGlowSoft,
		'--dark-glow-strong': withAlpha('#56dfff', 0.16),
		'--dark-glow-soft': withAlpha('#45d7b6', 0.12),
		'--dark-glow-tertiary': withAlpha('#79bbff', 0.1),
		'--light-glow-tertiary': withAlpha(mixColor(theme.colorBrand, theme.colorBrandSecondary, 0.48), 0.12),
		'--light-shadow-elevated': withAlpha(mixColor(theme.colorPrimary, '#0f172a', 0.18), 0.18),
		'--dark-shadow-elevated': 'rgba(3, 12, 24, 0.48)',
		'--light-image-shadow': `0 22px 44px -18px ${withAlpha(mixColor(theme.colorBrandSecondary, theme.colorBrand, 0.34), 0.3)}`,
		'--dark-image-shadow': `0 20px 46px -20px ${withAlpha('#071521', 0.44)}`,
		'--light-dock-shadow': `0 22px 42px -22px ${withAlpha(mixColor(theme.colorBrandSecondary, '#e8794a', 0.35), 0.3)}`,
		'--dark-dock-shadow': `0 18px 38px -18px ${withAlpha('#071521', 0.4)}`,
		'--light-code-button-bg': 'rgba(255, 255, 255, 0.92)',
		'--dark-code-button-bg': 'rgba(12, 27, 38, 0.82)',
		'--light-code-button-border': 'rgba(0, 0, 0, 0.08)',
		'--dark-code-button-border': 'rgba(255, 255, 255, 0.12)'
	} as Record<string, string>
}

export function buildThemeBootScript() {
	return `
		(function () {
			try {
				var key = '${THEME_STORAGE_KEY}';
				var stored = window.localStorage.getItem(key);
				var theme = stored === 'dark' || stored === 'light'
					? stored
					: (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

				document.documentElement.dataset.theme = theme;
				document.documentElement.style.colorScheme = theme;

				if (/windows|win32/i.test(navigator.userAgent)) {
					document.documentElement.classList.add('windows');
				}
			} catch (error) {
				document.documentElement.dataset.theme = 'light';
				document.documentElement.style.colorScheme = 'light';
			}
		})();
	`
}
