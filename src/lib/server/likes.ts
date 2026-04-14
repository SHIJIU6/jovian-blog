import { promises as fs } from 'node:fs'
import { getContentBindings } from './content/cloudflare'
import { ensureLocalContentDir, getLocalContentPath } from './local-content'
import { EMPTY_LIKE_STATE, type LikeState, type LikeStateMap } from '@/lib/like-types'

const LOCAL_LIKES_FILE = getLocalContentPath('runtime', 'likes', 'likes.json')
const LOCAL_VOTE_RETENTION_DAYS = 45
const D1_VOTE_TABLE = 'like_daily_votes'
const D1_COUNTER_TABLE = 'like_counters'

type LikeCounter = {
	count: number
	createdAt: string
	updatedAt: string
}

type LikeVote = {
	targetKey: string
	fingerprint: string
	voteDate: string
	createdAt: string
}

type LocalLikeStore = {
	counters: Record<string, LikeCounter>
	votes: Record<string, LikeVote>
}

export type LikeMutationResult = LikeState & {
	reason?: 'rate_limited'
}

const EMPTY_STORE: LocalLikeStore = {
	counters: {},
	votes: {}
}

let localMutationQueue: Promise<void> = Promise.resolve()
let volatileLocalStore: LocalLikeStore = {
	counters: {},
	votes: {}
}

function normalizeTargetKey(targetKey: string) {
	return targetKey.trim()
}

function normalizeTargetKeys(targetKeys: string[]) {
	return Array.from(new Set(targetKeys.map(normalizeTargetKey).filter(Boolean)))
}

function getVoteDate(input = new Date()) {
	return input.toISOString().slice(0, 10)
}

function getVoteKey(targetKey: string, fingerprint: string, voteDate: string) {
	return `${targetKey}::${fingerprint}::${voteDate}`
}

function getRetentionCutoffDate(retentionDays = LOCAL_VOTE_RETENTION_DAYS) {
	const next = new Date()
	next.setUTCDate(next.getUTCDate() - retentionDays)
	return getVoteDate(next)
}

function toPositiveInteger(value: unknown) {
	const next = typeof value === 'number' ? value : Number(value)
	return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0
}

function cloneStore(store: LocalLikeStore): LocalLikeStore {
	return {
		counters: { ...store.counters },
		votes: { ...store.votes }
	}
}

function pruneVotes(store: LocalLikeStore) {
	const cutoffDate = getRetentionCutoffDate()
	let changed = false
	for (const [key, vote] of Object.entries(store.votes)) {
		if (!vote || typeof vote.voteDate !== 'string' || vote.voteDate < cutoffDate) {
			delete store.votes[key]
			changed = true
		}
	}

	return changed
}

function isMissingTableError(error: unknown, tableName: string) {
	const message = String(error || '').toLowerCase()
	return message.includes('no such table') && message.includes(tableName.toLowerCase())
}

async function readLocalStore(): Promise<LocalLikeStore> {
	try {
		const text = await fs.readFile(LOCAL_LIKES_FILE, 'utf8')
		const parsed = JSON.parse(text) as Partial<LocalLikeStore>
		const nextStore = {
			counters: parsed?.counters && typeof parsed.counters === 'object' ? parsed.counters : {},
			votes: parsed?.votes && typeof parsed.votes === 'object' ? parsed.votes : {}
		}
		volatileLocalStore = cloneStore(nextStore)
		return nextStore
	} catch {
		return cloneStore(volatileLocalStore)
	}
}

async function writeLocalStore(store: LocalLikeStore) {
	volatileLocalStore = cloneStore(store)

	try {
		await ensureLocalContentDir(LOCAL_LIKES_FILE)
		await fs.writeFile(LOCAL_LIKES_FILE, JSON.stringify(store, null, 2), 'utf8')
	} catch {
		// Ignore write failures and keep the in-memory fallback so likes do not hard fail.
	}
}

async function withLocalStoreMutation<T>(mutate: (store: LocalLikeStore) => Promise<T> | T): Promise<T> {
	const run = localMutationQueue.then(async () => {
		const store = await readLocalStore()
		pruneVotes(store)
		const result = await mutate(store)
		await writeLocalStore(store)
		return result
	})

	localMutationQueue = run.then(
		() => undefined,
		() => undefined
	)

	return run
}

async function getLikeStateFromLocal(targetKey: string, fingerprint: string, voteDate: string): Promise<LikeState> {
	const states = await getLikeStatesFromLocal([targetKey], fingerprint, voteDate)
	return states[targetKey] || EMPTY_LIKE_STATE
}

async function getLikeStatesFromLocal(targetKeysInput: string[], fingerprint: string, voteDate: string): Promise<LikeStateMap> {
	const targetKeys = normalizeTargetKeys(targetKeysInput)
	if (targetKeys.length === 0) return {}

	const store = await readLocalStore()
	const pruned = pruneVotes(store)
	if (pruned) {
		await writeLocalStore(store)
	}

	return Object.fromEntries(
		targetKeys.map(targetKey => {
			const counter = store.counters[targetKey]
			return [
				targetKey,
				{
					count: toPositiveInteger(counter?.count),
					likedToday: Boolean(store.votes[getVoteKey(targetKey, fingerprint, voteDate)])
				}
			]
		})
	)
}

async function registerLikeInLocal(targetKey: string, fingerprint: string, voteDate: string): Promise<LikeMutationResult> {
	return withLocalStoreMutation(store => {
		const voteKey = getVoteKey(targetKey, fingerprint, voteDate)
		const existingVote = store.votes[voteKey]
		const currentCounter = store.counters[targetKey]
		const now = new Date().toISOString()

		if (existingVote) {
			return {
				count: toPositiveInteger(currentCounter?.count),
				likedToday: true,
				reason: 'rate_limited'
			}
		}

		store.votes[voteKey] = {
			targetKey,
			fingerprint,
			voteDate,
			createdAt: now
		}

		const nextCount = toPositiveInteger(currentCounter?.count) + 1
		store.counters[targetKey] = {
			count: nextCount,
			createdAt: currentCounter?.createdAt || now,
			updatedAt: now
		}

		return {
			count: nextCount,
			likedToday: true
		}
	})
}

async function countVotesInD1(db: any, targetKey: string): Promise<number | null> {
	try {
		const row = await db.prepare(`SELECT COUNT(*) as total FROM ${D1_VOTE_TABLE} WHERE target_key = ?`).bind(targetKey).first()
		return toPositiveInteger(row?.total)
	} catch {
		return null
	}
}

async function countVotesMapInD1(db: any, targetKeys: string[]): Promise<Map<string, number> | null> {
	if (targetKeys.length === 0) return new Map()

	const placeholders = targetKeys.map(() => '?').join(', ')
	try {
		const result = await db
			.prepare(`SELECT target_key, COUNT(*) as total FROM ${D1_VOTE_TABLE} WHERE target_key IN (${placeholders}) GROUP BY target_key`)
			.bind(...targetKeys)
			.all()
		const rows = Array.isArray(result?.results) ? result.results : []
		return new Map<string, number>(rows.map((row: Record<string, unknown>) => [String(row.target_key || ''), toPositiveInteger(row.total)]))
	} catch {
		return null
	}
}

async function backfillLikeCounterInD1(db: any, targetKey: string, timestamp: string) {
	await db
		.prepare(
			`INSERT INTO ${D1_COUNTER_TABLE} (target_key, total_count, created_at, updated_at)
			 VALUES (?, (SELECT COUNT(*) FROM ${D1_VOTE_TABLE} WHERE target_key = ?), ?, ?)
			 ON CONFLICT(target_key) DO UPDATE SET total_count = excluded.total_count, updated_at = excluded.updated_at`
		)
		.bind(targetKey, targetKey, timestamp, timestamp)
		.run()
}

async function incrementLikeCounterInD1(db: any, targetKey: string, timestamp: string) {
	const updateResult = await db
		.prepare(`UPDATE ${D1_COUNTER_TABLE} SET total_count = total_count + 1, updated_at = ? WHERE target_key = ?`)
		.bind(timestamp, targetKey)
		.run()

	if (Number(updateResult?.meta?.changes || 0) > 0) {
		return
	}

	await backfillLikeCounterInD1(db, targetKey, timestamp)
}

async function getLikeCountFromD1(db: any, targetKey: string): Promise<number | null> {
	try {
		const row = await db.prepare(`SELECT total_count as totalCount FROM ${D1_COUNTER_TABLE} WHERE target_key = ? LIMIT 1`).bind(targetKey).first()
		if (typeof row?.totalCount !== 'undefined') {
			return toPositiveInteger(row.totalCount)
		}

		const fallbackCount = await countVotesInD1(db, targetKey)
		if (fallbackCount === null) return null

		if (fallbackCount > 0) {
			await backfillLikeCounterInD1(db, targetKey, new Date().toISOString()).catch(() => undefined)
		}

		return fallbackCount
	} catch (error) {
		if (isMissingTableError(error, D1_COUNTER_TABLE)) {
			return countVotesInD1(db, targetKey)
		}

		return null
	}
}

async function getLikeCountMapFromD1(db: any, targetKeys: string[]): Promise<Map<string, number> | null> {
	if (targetKeys.length === 0) return new Map()

	const placeholders = targetKeys.map(() => '?').join(', ')

	try {
		const result = await db
			.prepare(`SELECT target_key, total_count as totalCount FROM ${D1_COUNTER_TABLE} WHERE target_key IN (${placeholders})`)
			.bind(...targetKeys)
			.all()
		const rows = Array.isArray(result?.results) ? result.results : []
		const countMap = new Map<string, number>(rows.map((row: Record<string, unknown>) => [String(row.target_key || ''), toPositiveInteger(row.totalCount)]))
		const missingKeys = targetKeys.filter(targetKey => !countMap.has(targetKey))
		if (missingKeys.length === 0) return countMap

		const fallbackCounts = await countVotesMapInD1(db, missingKeys)
		if (!fallbackCounts) return null

		for (const [targetKey, count] of fallbackCounts.entries()) {
			countMap.set(targetKey, count)
			if (count > 0) {
				await backfillLikeCounterInD1(db, targetKey, new Date().toISOString()).catch(() => undefined)
			}
		}

		return countMap
	} catch (error) {
		if (isMissingTableError(error, D1_COUNTER_TABLE)) {
			return countVotesMapInD1(db, targetKeys)
		}

		return null
	}
}

async function getLikeStateFromD1(db: any, targetKey: string, fingerprint: string, voteDate: string): Promise<LikeState | null> {
	const states = await getLikeStatesFromD1(db, [targetKey], fingerprint, voteDate)
	return states ? states[targetKey] || EMPTY_LIKE_STATE : null
}

async function getLikeStatesFromD1(db: any, targetKeysInput: string[], fingerprint: string, voteDate: string): Promise<LikeStateMap | null> {
	const targetKeys = normalizeTargetKeys(targetKeysInput)
	if (targetKeys.length === 0) return {}

	const placeholders = targetKeys.map(() => '?').join(', ')

	try {
		const [countMap, likedResult] = await Promise.all([
			getLikeCountMapFromD1(db, targetKeys),
			db
				.prepare(
					`SELECT target_key FROM ${D1_VOTE_TABLE} WHERE target_key IN (${placeholders}) AND client_fingerprint = ? AND vote_date = ?`
				)
				.bind(...targetKeys, fingerprint, voteDate)
				.all()
		])

		if (!countMap) return null

		const likedRows = Array.isArray(likedResult?.results) ? likedResult.results : []
		const likedKeys = new Set(likedRows.map((row: Record<string, unknown>) => String(row.target_key || '')).filter(Boolean))

		return Object.fromEntries(
			targetKeys.map(targetKey => [
				targetKey,
				{
					count: countMap.get(targetKey) ?? 0,
					likedToday: likedKeys.has(targetKey)
				}
			])
		)
	} catch {
		return null
	}
}

async function registerLikeInD1(db: any, targetKey: string, fingerprint: string, voteDate: string): Promise<LikeMutationResult | null> {
	try {
		const now = new Date().toISOString()
		const insertResult = await db
			.prepare(`INSERT OR IGNORE INTO ${D1_VOTE_TABLE} (target_key, client_fingerprint, vote_date, created_at) VALUES (?, ?, ?, ?)`)
			.bind(targetKey, fingerprint, voteDate, now)
			.run()

		if (Number(insertResult?.meta?.changes || 0) > 0) {
			try {
				await incrementLikeCounterInD1(db, targetKey, now)
			} catch (error) {
				if (!isMissingTableError(error, D1_COUNTER_TABLE)) {
					return null
				}
			}
		}

		const state = await getLikeStateFromD1(db, targetKey, fingerprint, voteDate)
		if (!state) return null

		return {
			...state,
			reason: Number(insertResult?.meta?.changes || 0) > 0 ? undefined : 'rate_limited'
		}
	} catch {
		return null
	}
}

export async function getLikeState(targetKeyInput: string, fingerprint: string): Promise<LikeState> {
	const targetKey = normalizeTargetKey(targetKeyInput)
	if (!targetKey) return EMPTY_LIKE_STATE

	const states = await getLikeStates([targetKey], fingerprint)
	return states[targetKey] || EMPTY_LIKE_STATE
}

export async function getLikeStates(targetKeysInput: string[], fingerprint: string): Promise<LikeStateMap> {
	const targetKeys = normalizeTargetKeys(targetKeysInput)
	if (targetKeys.length === 0) return {}

	const voteDate = getVoteDate()
	const env = await getContentBindings()

	if (env?.BLOG_DB) {
		const states = await getLikeStatesFromD1(env.BLOG_DB, targetKeys, fingerprint, voteDate)
		if (states) return states
	}

	return getLikeStatesFromLocal(targetKeys, fingerprint, voteDate)
}

export async function registerLike(targetKeyInput: string, fingerprint: string): Promise<LikeMutationResult> {
	const targetKey = normalizeTargetKey(targetKeyInput)
	const voteDate = getVoteDate()
	const env = await getContentBindings()

	if (env?.BLOG_DB) {
		const result = await registerLikeInD1(env.BLOG_DB, targetKey, fingerprint, voteDate)
		if (result) return result
	}

	return registerLikeInLocal(targetKey, fingerprint, voteDate)
}
