'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import GridView from './grid-view'
import CreateDialog from './components/create-dialog'
import { pushShares } from './services/push-shares'
import type { Share } from './components/share-card'
import type { LogoItem } from './components/logo-upload-dialog'
import { useManagementMode } from '@/hooks/use-management-mode'
import { useSharesContent } from '@/hooks/use-structured-content'
import { buildLikeTargetKey } from '@/lib/like-target'
import { useBatchLikes } from '@/hooks/use-batch-likes'
import { CommentBoard } from '@/components/comment-board'
import { useAutoLoadMore } from '@/hooks/use-auto-load-more'
import { usePathname } from 'next/navigation'

export default function Page() {
	const { data: remoteShares, mutate: mutateShares, hasMore, loadMore, isLoadingMore } = useSharesContent()
	const [shares, setShares] = useState<Share[]>([])
	const [originalShares, setOriginalShares] = useState<Share[]>([])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [editingShare, setEditingShare] = useState<Share | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [logoItems, setLogoItems] = useState<Map<string, LogoItem>>(new Map())
	const listScrollRef = useRef<HTMLDivElement>(null)
	const canManage = useManagementMode()
	const isStudioView = usePathname().startsWith('/studio')

	useEffect(() => {
		if (!remoteShares || isEditMode) return
		setShares(remoteShares)
		setOriginalShares(remoteShares)
	}, [remoteShares, isEditMode])

	const shareLikeKeys = useMemo(() => shares.map(share => buildLikeTargetKey(share.id, 'share')).filter(Boolean), [shares])
	const { getLikeState, updateLikeState } = useBatchLikes(shareLikeKeys)
	useAutoLoadMore({ hasMore, isLoading: isLoadingMore || isEditMode, enabled: !isEditMode, rootRef: listScrollRef, loadMore })

	const handleUpdate = (updatedShare: Share, oldShare: Share, logoItem?: LogoItem) => {
		setShares(prev => prev.map(share => (share.id === oldShare.id ? updatedShare : share)))
		if (logoItem) {
			setLogoItems(prev => {
				const newMap = new Map(prev)
				newMap.set(updatedShare.id, logoItem)
				return newMap
			})
		}
	}

	const handleAdd = () => {
		if (!isEditMode) setIsEditMode(true)
		setEditingShare(null)
		setIsCreateDialogOpen(true)
	}

	const handleSaveShare = (updatedShare: Share, logoItem?: LogoItem) => {
		if (editingShare) {
			const updated = shares.map(share => (share.id === editingShare.id ? updatedShare : share))
			setShares(updated)
		} else {
			setShares([...shares, updatedShare])
		}
		if (logoItem) {
			setLogoItems(prev => {
				const newMap = new Map(prev)
				newMap.set(updatedShare.id, logoItem)
				return newMap
			})
		}
	}

	const handleDelete = (share: Share) => {
		if (confirm(`确定要删除 ${share.name} 吗？`)) {
			setShares(shares.filter(item => item.id !== share.id))
		}
	}

	const handleSave = async () => {
		setIsSaving(true)

		try {
			const savedShares = await pushShares({
				shares,
				logoItems
			})

			await mutateShares(savedShares, { revalidate: false })
			setShares(savedShares)
			setOriginalShares(savedShares)
			setLogoItems(new Map())
			setIsEditMode(false)
			toast.success('保存成功！')
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancel = () => {
		setShares(originalShares)
		setLogoItems(new Map())
		setIsEditMode(false)
	}

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

	return (
		<>
			<div className='mx-auto w-full max-w-7xl px-6 pt-24 pb-12'>
				<div ref={listScrollRef} className='h-[calc(100vh-18rem)] min-h-[360px] overflow-y-auto overflow-x-hidden pr-2'>
					<GridView
						shares={shares}
						isEditMode={isEditMode}
						onUpdate={handleUpdate}
						onDelete={handleDelete}
						getLikeState={getLikeState}
						onLikeStateChange={updateLikeState}
						readOnlyLike={canManage}
						className='w-full'
					/>
					{hasMore && !isEditMode && <div className='text-secondary py-6 text-center text-sm'>{isLoadingMore ? '加载更多资源中...' : '继续向下滚动加载更多'}</div>}
				</div>
			</div>

			{!isStudioView && <div className='mx-auto mt-6 w-full max-w-[980px] px-6 pb-6'><CommentBoard targetType='share' targetId='shares' title='资源留言板' /></div>}
			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						{isStudioView && <CommentBoard targetType='share' targetId='shares' title='资源留言板' adminMode className='z-30' />}
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={isSaving}
							className='surface-btn px-6'>
							取消
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleAdd}
							className='surface-btn px-6'>
							添加
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => void handleSave()} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : '保存'}
						</motion.button>
					</>
				) : (
					canManage && (
						<>
							{isStudioView && <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAdd} className='brand-btn px-6'>添加</motion.button>}
							{isStudioView && <CommentBoard targetType='share' targetId='shares' title='资源留言板' adminMode className='z-30' />}
							<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsEditMode(true)} className='surface-btn px-6'>编辑</motion.button>
						</>
					)
				)}
			</motion.div>

			{isCreateDialogOpen && <CreateDialog share={editingShare} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveShare} />}
		</>
	)
}
