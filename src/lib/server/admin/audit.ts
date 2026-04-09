import { getContentBindings } from '../content/cloudflare'

type AuditInput = {
	actorEmail?: string | null
	action: string
	targetType: string
	targetId?: string | null
	payload?: unknown
}

export type AuditLogItem = {
	id: string
	actorEmail?: string
	action: string
	targetType: string
	targetId?: string
	payloadJson?: string
	createdAt: string
}

/**
 * Reference: Cloudflare D1 docs (Workers prepared statements with bind parameters, retrieved via Context7 on 2026-04-09).
 * Audit writes stay best-effort so admin actions are observable without turning logging failures into content-loss failures.
 */

function serializePayload(payload: unknown) {
	if (payload === undefined) return null

	try {
		const json = JSON.stringify(payload)
		return json.length > 8000 ? `${json.slice(0, 8000)}…` : json
	} catch {
		return null
	}
}

export async function writeAuditLog(input: AuditInput) {
	try {
		const env = await getContentBindings()
		if (!env?.BLOG_DB) return

		await env.BLOG_DB.prepare(
			'INSERT INTO audit_logs (id, actor_email, action, target_type, target_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		)
			.bind(
				crypto.randomUUID(),
				input.actorEmail || null,
				input.action,
				input.targetType,
				input.targetId || null,
				serializePayload(input.payload),
				new Date().toISOString()
			)
			.run()
	} catch {
		// Audit logging should not block the primary admin mutation.
	}
}

export async function listAuditLogs(limit = 50): Promise<AuditLogItem[]> {
	try {
		const env = await getContentBindings()
		if (!env?.BLOG_DB) return []

		const safeLimit = Math.max(1, Math.min(limit, 200))
		const result = await env.BLOG_DB.prepare(
			`SELECT id, actor_email, action, target_type, target_id, payload_json, created_at
			 FROM audit_logs
			 ORDER BY created_at DESC
			 LIMIT ?`
		)
			.bind(safeLimit)
			.all()

		const rows = Array.isArray(result?.results) ? (result.results as Array<Record<string, unknown>>) : []
		return rows.map(row => ({
			id: String(row.id || ''),
			actorEmail: typeof row.actor_email === 'string' ? row.actor_email : undefined,
			action: String(row.action || ''),
			targetType: String(row.target_type || ''),
			targetId: typeof row.target_id === 'string' ? row.target_id : undefined,
			payloadJson: typeof row.payload_json === 'string' ? row.payload_json : undefined,
			createdAt: String(row.created_at || '')
		}))
	} catch {
		return []
	}
}
