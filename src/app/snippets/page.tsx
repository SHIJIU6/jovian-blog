'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import { ItemLikeButton } from '@/components/item-like-button'
import { LikeCountBadge } from '@/components/like-count-badge'
import { pushSnippets } from './services/push-snippets'
import { useManagementMode } from '@/hooks/use-management-mode'
import { useSnippetsContent } from '@/hooks/use-structured-content'
import { buildLikeTargetKey } from '@/lib/like-target'
import { createContentItemId, type SnippetItem } from '@/lib/content-item-id'
import { useBatchLikes } from '@/hooks/use-batch-likes'
import { useAutoLoadMore } from '@/hooks/use-auto-load-more'

const getRandomSnippet = (list: SnippetItem[]) => (list.length === 0 ? null : list[Math.floor(Math.random() * list.length)] || null)

export default function Page() {
	const { data: remoteSnippets, mutate, hasMore, loadMore, isLoadingMore } = useSnippetsContent()
	const [snippets, setSnippets] = useState<SnippetItem[]>([])
	const [originalSnippets, setOriginalSnippets] = useState<SnippetItem[]>([])
	const [currentSnippetId, setCurrentSnippetId] = useState('')
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isManageOpen, setIsManageOpen] = useState(false)
	const [draftSnippets, setDraftSnippets] = useState<SnippetItem[]>([])
	const [newSnippet, setNewSnippet] = useState('')
	const canManage = useManagementMode()

	useEffect(() => {
		if (!remoteSnippets || isEditMode) return
		setSnippets(remoteSnippets)
		setOriginalSnippets(remoteSnippets)
		const nextCurrentSnippet = remoteSnippets.find(item => item.id === currentSnippetId) || getRandomSnippet(remoteSnippets)
		setCurrentSnippetId(nextCurrentSnippet?.id || '')
	}, [remoteSnippets, isEditMode, currentSnippetId])

	useEffect(() => {
		if (!canManage) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				setIsEditMode(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [canManage, isEditMode])

	const snippetLikeKeys = useMemo(() => snippets.map(item => buildLikeTargetKey(item.id, 'snippet')).filter(Boolean), [snippets])
	const { getLikeState, updateLikeState } = useBatchLikes(snippetLikeKeys)
	useAutoLoadMore({ hasMore, isLoading: isLoadingMore || isEditMode, enabled: !isEditMode, loadMore })
	const currentSnippet = useMemo(() => snippets.find(item => item.id === currentSnippetId) || snippets[0] || null, [snippets, currentSnippetId])
	const currentLikeTargetKey = currentSnippet ? buildLikeTargetKey(currentSnippet.id, 'snippet') : ''

	const persistSnippets = async (nextSnippets: SnippetItem[], options?: { closeEditMode?: boolean; closeManage?: boolean }) => {
		setIsSaving(true)
		try {
			await pushSnippets({ snippets: nextSnippets })
			setSnippets(nextSnippets)
			setOriginalSnippets(nextSnippets)
			const nextCurrentSnippet = nextSnippets.find(item => item.id === currentSnippetId) || nextSnippets[nextSnippets.length - 1] || getRandomSnippet(nextSnippets)
			setCurrentSnippetId(nextCurrentSnippet?.id || '')
			await mutate(nextSnippets, { revalidate: false })
			if (options?.closeEditMode) setIsEditMode(false)
			if (options?.closeManage) setIsManageOpen(false)
			setDraftSnippets([])
			setNewSnippet('')
			toast.success('保存成功！')
		} catch (error: any) {
			console.error('Failed to save snippets:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleSave = async () => {
		await persistSnippets(snippets, { closeEditMode: true })
	}

	const handleCancel = () => {
		setSnippets(originalSnippets)
		const fallbackSnippet = originalSnippets.find(item => item.id === currentSnippetId) || originalSnippets[0] || null
		setCurrentSnippetId(fallbackSnippet?.id || '')
		setIsEditMode(false)
	}

	const openManageDialog = () => {
		setDraftSnippets(snippets.map(item => ({ ...item })))
		setNewSnippet('')
		setIsManageOpen(true)
	}

	const handleAddDraft = () => {
		const value = newSnippet.trim()
		if (!value) {
			toast.error('请输入句子')
			return
		}
		setDraftSnippets(prev => [...prev, { id: createContentItemId('snippet'), content: value }])
		setNewSnippet('')
	}

	const handleRemoveDraft = (id: string) => {
		setDraftSnippets(prev => prev.filter(item => item.id !== id))
	}

	const applyManageChanges = async () => {
		const cleaned = draftSnippets.map(item => ({ ...item, content: item.content.trim() })).filter(item => item.content)
		if (cleaned.length === 0) {
			toast.error('请至少添加一句话')
			return
		}
		await persistSnippets(cleaned, { closeManage: true })
	}

	const cancelManageChanges = () => {
		setIsManageOpen(false)
		setDraftSnippets([])
		setNewSnippet('')
	}

	const handleRotateSnippet = () => {
		const nextSnippet = getRandomSnippet(snippets)
		setCurrentSnippetId(nextSnippet?.id || '')
	}

	return (
		<>
			{canManage ? (
				<div className='px-6 pt-24 pb-12'>
					<div className='mx-auto max-w-5xl space-y-6'>
						<section className='bg-card rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
							<div className='flex flex-wrap items-center justify-between gap-4'>
								<div className='space-y-2'>
									<p className='text-secondary text-xs uppercase tracking-[0.24em]'>Snippets</p>
									<h2 className='text-2xl font-semibold'>短句列表</h2>
									<p className='text-secondary text-sm leading-7'>这里维护首页轮播短句、签名和随感。前台会自动轮询展示其中内容。</p>
								</div>
								<div className='rounded-2xl border bg-white/55 px-4 py-3 text-sm'>
									当前共 <span className='font-medium'>{snippets.length}</span> 条
								</div>
							</div>
						</section>

						<section className='bg-card rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
							<div className='space-y-3'>
								{snippets.length === 0 ? (
									<div className='text-secondary py-8 text-center text-sm'>当前还没有短句，点击右上角“编辑”开始添加。</div>
								) : (
									snippets.map((item, index) => {
										const likeTargetKey = buildLikeTargetKey(item.id, 'snippet')
										const likeState = getLikeState(likeTargetKey)
										return (
											<div key={item.id} className='flex items-start gap-4 rounded-2xl border bg-white/45 px-4 py-3'>
												<div className='text-secondary mt-1 w-8 shrink-0 text-sm font-medium'>{index + 1}</div>
												<p className='flex-1 text-sm leading-7 text-gray-800'>{item.content}</p>
												<LikeCountBadge count={likeState.count} likedToday={likeState.likedToday} />
											</div>
										)
									})
								)}
							</div>
						</section>
					</div>
				</div>
			) : (
				<div className='flex min-h-[70vh] flex-col items-center justify-center px-6 py-24'>
					<div className='w-full max-w-3xl space-y-6 text-center'>
						<p className='text-2xl leading-relaxed font-semibold'>{currentSnippet?.content || '无'}</p>
						<div className='flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500'>
							<span>当前共 {snippets.length} 条短句</span>
							{snippets.length > 1 && (
								<button
									type='button'
									onClick={handleRotateSnippet}
									className='rounded-full border bg-white/60 px-3 py-1 transition-colors hover:bg-white/80'>
									换一句
								</button>
							)}
						</div>
						{currentSnippet && currentLikeTargetKey && (
							<div className='flex items-center justify-center'>
								<ItemLikeButton
									targetKey={currentLikeTargetKey}
									state={getLikeState(currentLikeTargetKey)}
									onStateChange={nextState => updateLikeState(currentLikeTargetKey, nextState)}
									className='px-4 py-2 text-sm'
								/>
							</div>
						)}
					</div>
				</div>
			)}

			{hasMore && !isEditMode && <div className='text-secondary pb-8 text-center text-sm'>{isLoadingMore ? '加载更多短句中...' : '继续向下滚动加载更多'}</div>}

			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={isSaving}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							关闭编辑
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={openManageDialog}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							管理
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleSave()} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : '保存'}
						</motion.button>
					</>
				) : (
					canManage && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setIsEditMode(true)}
							className='bg-card rounded-xl border px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>

			<DialogModal open={isManageOpen} onClose={cancelManageChanges} className='card static w-[520px] max-sm:w-full'>
				<div className='space-y-4'>
					<div className='flex items-center gap-3'>
						<input
							type='text'
							value={newSnippet}
							onChange={e => setNewSnippet(e.target.value)}
							placeholder='新增'
							className='flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none'
						/>
						<button onClick={handleAddDraft} className='brand-btn flex items-center gap-1 px-4 py-2 text-sm'>
							<Plus className='h-4 w-4' />
							新增
						</button>
					</div>

					<div className='max-h-[320px] space-y-2 overflow-y-auto pr-1'>
						{draftSnippets.length === 0 && <p className='text-secondary py-6 text-center text-sm'>暂无内容</p>}
						{draftSnippets.map(item => (
							<div key={item.id} className='group flex items-start gap-3 rounded-lg px-3 py-2 text-sm'>
								<p className='flex-1 leading-relaxed text-gray-800'>{item.content}</p>
								<button onClick={() => handleRemoveDraft(item.id)} className='text-gray-400 transition-colors hover:text-red-500'>
									<X className='h-4 w-4' />
								</button>
							</div>
						))}
					</div>

					<div className='mt-4 flex gap-3'>
						<button
							onClick={cancelManageChanges}
							className='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
							取消
						</button>
						<button onClick={applyManageChanges} className='brand-btn flex-1 justify-center px-4'>
							保存
						</button>
					</div>
				</div>
			</DialogModal>
		</>
	)
}
