import { headers } from 'next/headers'
import { evaluateAdminHeaders } from '@/lib/server/admin/auth'
import { StudioShell } from '@/components/studio-shell'
import { StudioLocked } from '@/components/studio-locked'

export default async function StudioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const headerStore = await headers()
	const result = await evaluateAdminHeaders(headerStore, process.env.ADMIN_ALLOWLIST)

	if (!result.ok) {
		return <StudioLocked reason={result.reason} />
	}

	return <StudioShell>{children}</StudioShell>
}
