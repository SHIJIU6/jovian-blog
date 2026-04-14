import { promises as fs } from 'node:fs'
import { getContentBindings } from './content/cloudflare'
import { ensureLocalContentDir, getLocalContentPath } from './local-content'

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

export type LikeState = {
	count: number
	likedToday: boolean
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
	const store = await readLocalStore()
	const pruned = pruneVotes(store)
	if (pruned) {
		await writeLocalStore(store)
	}

	const counter = store.counters[targetKey]
	return {
		count: toPositiveInteger(counter?.count),
		likedToday: Boolean(store.votes[getVoteKey(targetKey, fingerprint, voteDate)])
	}
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

async function syncLikeCounterInD1(db: any, targetKey: string, timestamp: string) {
	await db
		.prepare(
			`INSERT INTO ${D1_COUNTER_TABLE} (target_key, total_count, created_at, updated_at)
			 VALUES (?, (SELECT COUNT(*) FROM ${D1_VOTE_TABLE} WHERE target_key = ?), ?, ?)
			 ON CONFLICT(target_key) DO UPDATE SET total_count = excluded.total_count, updated_at = excluded.updated_at`
		)
		.bind(targetKey, targetKey, timestamp, timestamp)
		.run()
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
			await syncLikeCounterInD1(db, targetKey, new Date().toISOString()).catch(() => undefined)
		}

		return fallbackCount
	} catch (error) {
		if (isMissingTableError(error, D1_COUNTER_TABLE)) {
			return countVotesInD1(db, targetKey)
		}

		return null
	}
}

async function getLikeStateFromD1(db: any, targetKey: string, fingerprint: string, voteDate: string): Promise<LikeState | null> {
	try {
		const [count, likedRow] = await Promise.all([
			getLikeCountFromD1(db, targetKey),
			db
				.prepare(`SELECT 1 as liked FROM ${D1_VOTE_TABLE} WHERE target_key = ? AND client_fingerprint = ? AND vote_date = ? LIMIT 1`)
				.bind(targetKey, fingerprint, voteDate)
				.first()
		])

		if (count === null) return null

		return {
			count,
			likedToday: Boolean(likedRow)
		}
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
				await syncLikeCounterInD1(db, targetKey, now)
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
	const voteDate = getVoteDate()
	const env = await getContentBindings()

	if (env?.BLOG_DB) {
		const state = await getLikeStateFromD1(env.BLOG_DB, targetKey, fingerprint, voteDate)
		if (state) return state
	}

	return getLikeStateFromLocal(targetKey, fingerprint, voteDate)
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
