import { getContentBindings } from '../content/cloudflare'

type AiJobStatus = 'queued' | 'completed' | 'failed'

/**
 * Reference: Cloudflare D1 prepared statements docs and current OpenNext Cloudflare adapter usage
 * (`@opennextjs/cloudflare` 1.14.4 in package.json).
 * AI job persistence is best-effort locally and becomes durable when BLOG_DB is configured.
 */

export async function createAiJob(jobType: string, input: unknown) {
	const id = crypto.randomUUID()
	const env = await getContentBindings()

	if (!env?.BLOG_DB) {
		return { id, persisted: false }
	}

	try {
		await env.BLOG_DB.prepare(
			'INSERT INTO ai_jobs (id, job_type, status, input_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
		)
			.bind(id, jobType, 'queued', JSON.stringify(input), new Date().toISOString(), new Date().toISOString())
			.run()
		return { id, persisted: true }
	} catch {
		return { id, persisted: false }
	}
}

export async function updateAiJob(jobId: string, status: AiJobStatus, payload: { output?: unknown; errorMessage?: string }) {
	const env = await getContentBindings()
	if (!env?.BLOG_DB) return

	try {
		await env.BLOG_DB.prepare(
			`UPDATE ai_jobs
			 SET status = ?, output_json = ?, error_message = ?, updated_at = ?
			 WHERE id = ?`
		)
			.bind(status, payload.output ? JSON.stringify(payload.output) : null, payload.errorMessage || null, new Date().toISOString(), jobId)
			.run()
	} catch {
		// Do not fail the main AI flow because of job history persistence.
	}
}
