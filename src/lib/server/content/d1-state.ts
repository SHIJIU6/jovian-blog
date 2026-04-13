const STORAGE_STATE_PREFIX = 'storage_initialized::'

function getStorageStateKey(scope: string) {
	return `${STORAGE_STATE_PREFIX}${scope}`
}

export async function isD1ScopeInitialized(db: any, scope: string) {
	try {
		const row = await db.prepare('SELECT value_json FROM site_settings WHERE key = ? LIMIT 1').bind(getStorageStateKey(scope)).first()
		return row?.value_json === 'true'
	} catch {
		return false
	}
}

export async function markD1ScopeInitialized(db: any, scope: string) {
	try {
		const now = new Date().toISOString()
		await db
			.prepare(
				'INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at'
			)
			.bind(getStorageStateKey(scope), 'true', now)
			.run()
	} catch {
		// Ignore marker failures so content writes are not blocked by metadata drift.
	}
}
