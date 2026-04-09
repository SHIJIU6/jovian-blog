'use client'

import { usePathname } from 'next/navigation'

export function useManagementMode() {
	const pathname = usePathname()
	return pathname.startsWith('/studio')
}
