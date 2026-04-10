import type { NextRequest } from 'next/server'
import { getContentBindings } from '../content/cloudflare'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

type AdminAuthResult = {
	ok: boolean
	email?: string
	role?: string
	source?: 'local-dev' | 'admins-table' | 'allowlist' | 'service-token'
	reason?: string
}

function parseAllowlist(raw?: string | null): string[] {
	if (!raw) return []
	return raw
		.split(',')
		.map(item => item.trim().toLowerCase())
		.filter(Boolean)
}

function getEmailFromHeaders(headers: Headers): string | null {
	return (
		headers.get('cf-access-authenticated-user-email') ||
		headers.get('Cf-Access-Authenticated-User-Email') ||
		headers.get('x-admin-email') ||
		null
	)
}

function getTokenFromHeaders(headers: Headers): string | null {
	const authHeader = headers.get('authorization') || headers.get('Authorization')
	if (authHeader?.startsWith('Bearer ')) {
		return authHeader.slice('Bearer '.length).trim()
	}

	return headers.get('x-blog-admin-token') || null
}

function getHostFromHeaders(headers: Headers): string {
	return (headers.get('host') || '').split(':')[0].trim().toLowerCase()
}

function isLocalRequest(headers: Headers): boolean {
	return LOCAL_HOSTS.has(getHostFromHeaders(headers))
}

function isLocalBypassEnabled() {
	return process.env.BLOG_LOCAL_ADMIN_BYPASS !== 'false'
}

async function getAdminAccessFromD1(email: string) {
	try {
		const env = await getContentBindings()
		if (!env?.BLOG_DB) return null

		// Reference: Cloudflare D1 docs for Workers prepared statements with bind parameters, plus OpenNext Cloudflare v1.14.4 binding access.
		// We treat the admins table as the primary source of truth once it has at least one row, and only fall back to ADMIN_ALLOWLIST during bootstrap.
		const countRow = await env.BLOG_DB.prepare('SELECT COUNT(*) as total FROM admins').first()
		const total = Number(countRow?.total || 0)
		if (!Number.isFinite(total) || total <= 0) {
			return { mode: 'empty' as const }
		}

		const admin = await env.BLOG_DB.prepare('SELECT email, role FROM admins WHERE lower(email) = ? LIMIT 1').bind(email.toLowerCase()).first()
		if (!admin?.email) {
			return { mode: 'configured' as const, found: false }
		}

		return {
			mode: 'configured' as const,
			found: true,
			email: String(admin.email),
			role: typeof admin.role === 'string' ? admin.role : 'viewer'
		}
	} catch {
		return null
	}
}

export async function evaluateAdminHeaders(headers: Headers, allowlistRaw?: string | null): Promise<AdminAuthResult> {
	if (isLocalRequest(headers) && isLocalBypassEnabled()) {
		return { ok: true, reason: 'local-dev', role: 'owner', source: 'local-dev' }
	}

	const configuredServiceToken = process.env.BLOG_ADMIN_TOKEN
	const requestToken = getTokenFromHeaders(headers)
	if (configuredServiceToken && requestToken && requestToken === configuredServiceToken) {
		return {
			ok: true,
			email: 'mcp-service',
			role: 'owner',
			source: 'service-token'
		}
	}

	const email = getEmailFromHeaders(headers)
	if (!email) {
		return { ok: false, reason: 'missing-access-email' }
	}

	const d1Access = await getAdminAccessFromD1(email)
	if (d1Access?.mode === 'configured') {
		if (!d1Access.found) {
			return { ok: false, reason: 'email-not-in-admins', email }
		}

		return {
			ok: true,
			email: d1Access.email,
			role: d1Access.role,
			source: 'admins-table'
		}
	}

	const allowlist = parseAllowlist(allowlistRaw)
	if (allowlist.length === 0) {
		return { ok: false, reason: 'missing-admin-allowlist' }
	}

	if (!allowlist.includes(email.toLowerCase())) {
		return { ok: false, reason: 'email-not-allowed', email }
	}

	return { ok: true, email, role: 'owner', source: 'allowlist' }
}

export async function evaluateAdminRequest(request: Request | NextRequest, allowlistRaw?: string | null): Promise<AdminAuthResult> {
	return evaluateAdminHeaders(request.headers, allowlistRaw ?? process.env.ADMIN_ALLOWLIST)
}

export function createUnauthorizedAdminResponse(reason: string, status = 401) {
	return Response.json(
		{
			error: 'Unauthorized',
			reason
		},
		{ status }
	)
}
