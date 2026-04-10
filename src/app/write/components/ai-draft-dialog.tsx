'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import aiMessages from '@/config/i18n/write-ai.zh-CN.json'
import { DialogModal } from '@/components/dialog-modal'
import { useWriteStore } from '../stores/write-store'
import { generateAiDraft, toPublishForm } from '../services/generate-ai-draft'

type AiDraftDialogProps = {
	open: boolean
	onClose: () => void
}

const initialState = {
	topic: '',
	angle: '',
	audience: '',
	tone: '',
	withWebResearch: true
}

export function AiDraftDialog({ open, onClose }: AiDraftDialogProps) {
	const { form, applyGeneratedDraft } = useWriteStore()
	const [state, setState] = useState(initialState)
	const [loading, setLoading] = useState(false)

	const updateField = (field: keyof typeof initialState, value: string | boolean) => {
		setState(current => ({ ...current, [field]: value }))
	}

	const handleClose = () => {
		if (!loading) {
			onClose()
		}
	}

	const handleGenerate = async () => {
		if (!state.topic.trim()) {
			toast.error(aiMessages.error)
			return
		}

		if ((form.title || form.md || form.summary) && !window.confirm(aiMessages.overwriteConfirm)) {
			return
		}

		try {
			setLoading(true)
			const payload = await generateAiDraft({
				topic: state.topic.trim(),
				angle: state.angle.trim() || undefined,
				audience: state.audience.trim() || undefined,
				tone: state.tone.trim() || undefined,
				withWebResearch: state.withWebResearch
			})

			applyGeneratedDraft(toPublishForm(payload.result))
			toast.success(`${aiMessages.success} (${payload.result.provider === 'openai' ? aiMessages.providerOpenAi : aiMessages.providerMock})`)
			onClose()
			setState(initialState)
		} catch (error: any) {
			console.error(error)
			toast.error(error?.message || aiMessages.error)
		} finally {
			setLoading(false)
		}
	}

	return (
		<DialogModal open={open} onClose={handleClose} className='bg-card w-full max-w-2xl rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)]'>
			<div className='space-y-5'>
				<div className='space-y-2'>
					<p className='text-secondary text-xs uppercase tracking-[0.24em]'>{aiMessages.open}</p>
					<h2 className='text-2xl font-semibold'>{aiMessages.title}</h2>
					<p className='text-secondary text-sm leading-7'>{aiMessages.description}</p>
					<div className='rounded-2xl border bg-white/50 px-4 py-3 text-sm'>
						<span className='text-secondary mr-2'>{aiMessages.providerLabel}:</span>
						<span className='font-medium'>{aiMessages.providerAuto}</span>
					</div>
				</div>

				<div className='grid gap-4 md:grid-cols-2'>
					<label className='space-y-2 md:col-span-2'>
						<span className='text-sm font-medium'>{aiMessages.topicLabel}</span>
						<input
							type='text'
							value={state.topic}
							onChange={event => updateField('topic', event.target.value)}
							placeholder={aiMessages.topicPlaceholder}
							className='bg-card block w-full rounded-xl border px-3 py-2 text-sm'
						/>
					</label>

					<label className='space-y-2 md:col-span-2'>
						<span className='text-sm font-medium'>{aiMessages.angleLabel}</span>
						<input
							type='text'
							value={state.angle}
							onChange={event => updateField('angle', event.target.value)}
							placeholder={aiMessages.anglePlaceholder}
							className='bg-card block w-full rounded-xl border px-3 py-2 text-sm'
						/>
					</label>

					<label className='space-y-2'>
						<span className='text-sm font-medium'>{aiMessages.audienceLabel}</span>
						<input
							type='text'
							value={state.audience}
							onChange={event => updateField('audience', event.target.value)}
							placeholder={aiMessages.audiencePlaceholder}
							className='bg-card block w-full rounded-xl border px-3 py-2 text-sm'
						/>
					</label>

					<label className='space-y-2'>
						<span className='text-sm font-medium'>{aiMessages.toneLabel}</span>
						<input
							type='text'
							value={state.tone}
							onChange={event => updateField('tone', event.target.value)}
							placeholder={aiMessages.tonePlaceholder}
							className='bg-card block w-full rounded-xl border px-3 py-2 text-sm'
						/>
					</label>
				</div>

				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={state.withWebResearch}
						onChange={event => updateField('withWebResearch', event.target.checked)}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>{aiMessages.researchToggle}</span>
				</label>

				<div className='flex justify-end gap-3'>
					<motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={handleClose} className='bg-card rounded-xl border px-5 py-2.5 text-sm'>
						{aiMessages.cancel}
					</motion.button>
					<motion.button
						whileHover={{ scale: 1.03 }}
						whileTap={{ scale: 0.98 }}
						onClick={() => void handleGenerate()}
						disabled={loading}
						className='brand-btn px-6'>
						{loading ? aiMessages.loading : aiMessages.generate}
					</motion.button>
				</div>
			</div>
		</DialogModal>
	)
}
