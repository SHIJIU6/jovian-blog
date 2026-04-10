import { writeAuditLog } from '../admin/audit'
import { createAiJob, updateAiJob } from './jobs'
import { mockGenerateDraft, mockResearchTopic } from './mock'
import { openAiGenerateDraft, openAiResearchTopic } from './openai'
import type { GenerateDraftInput, ResearchTopicInput } from './types'

function shouldUseMockProvider() {
	return process.env.AI_PROVIDER === 'mock' || !process.env.OPENAI_API_KEY
}

export async function researchTopic(input: ResearchTopicInput) {
	const job = await createAiJob('research_topic', input)

	try {
		const result = shouldUseMockProvider() ? mockResearchTopic(input) : await openAiResearchTopic(input)
		await updateAiJob(job.id, 'completed', { output: result })
		await writeAuditLog({
			action: 'ai.research_topic',
			targetType: 'ai_job',
			targetId: job.id,
			payload: {
				provider: result.provider,
				topic: input.topic,
				withWebResearch: Boolean(input.withWebResearch)
			}
		})
		return { jobId: job.id, result }
	} catch (error: any) {
		await updateAiJob(job.id, 'failed', { errorMessage: error?.message || 'Unknown AI research error' })
		throw error
	}
}

export async function generateDraft(input: GenerateDraftInput) {
	const job = await createAiJob('generate_draft', input)

	try {
		const result = shouldUseMockProvider() ? mockGenerateDraft(input) : await openAiGenerateDraft(input)
		await updateAiJob(job.id, 'completed', { output: result })
		await writeAuditLog({
			action: 'ai.generate_draft',
			targetType: 'ai_job',
			targetId: job.id,
			payload: {
				provider: result.provider,
				topic: input.topic,
				slug: result.slug,
				tagCount: result.tags.length
			}
		})
		return { jobId: job.id, result }
	} catch (error: any) {
		await updateAiJob(job.id, 'failed', { errorMessage: error?.message || 'Unknown AI draft error' })
		throw error
	}
}
