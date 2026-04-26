'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import GridView, { type Blogger } from './grid-view'
import CreateDialog from './components/create-dialog'
import { pushBloggers } from './services/push-bloggers'
import type { AvatarItem } from './components/avatar-upload-dialog'
import { useManagementMode } from '@/hooks/use-management-mode'
import { useBloggersContent } from '@/hooks/use-structured-content'
import { buildLikeTargetKey } from '@/lib/like-target'
import { useBatchLikes } from '@/hooks/use-batch-likes'
import { CommentBoard } from '@/components/comment-board'
import { useAutoLoadMore } from '@/hooks/use-auto-load-more'
import { usePathname } from 'next/navigation'

export default function Page() {
	const { data: remoteBloggers, mutate: mutateBloggers, hasMore, loadMore, isLoadingMore } = useBloggersContent()
	const [bloggers, setBloggers] = useState<Blogger[]>([])
	const [originalBloggers, setOriginalBloggers] = useState<Blogger[]>([])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [editingBlogger, setEditingBlogger] = useState<Blogger | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [avatarItems, setAvatarItems] = useState<Map<string, AvatarItem>>(new Map())
	const listScrollRef = useRef<HTMLDivElement>(null)
	const canManage = useManagementMode()
	const isStudioView = usePathname().startsWith('/studio')

	useEffect(() => {
		if (!remoteBloggers || isEditMode) return
		setBloggers(remoteBloggers)
		setOriginalBloggers(remoteBloggers)
	}, [remoteBloggers, isEditMode])

	const bloggerLikeKeys = useMemo(() => bloggers.map(blogger => buildLikeTargetKey(blogger.id, 'blogger')).filter(Boolean), [bloggers])
	const { getLikeState, updateLikeState } = useBatchLikes(bloggerLikeKeys)
	useAutoLoadMore({ hasMore, isLoading: isLoadingMore || isEditMode, enabled: !isEditMode, rootRef: listScrollRef, loadMore })

	const handleUpdate = (updatedBlogger: Blogger, oldBlogger: Blogger, avatarItem?: AvatarItem) => {
		setBloggers(prev => prev.map(blogger => (blogger.id === oldBlogger.id ? updatedBlogger : blogger)))
		if (avatarItem) {
			setAvatarItems(prev => {
				const newMap = new Map(prev)
				newMap.set(updatedBlogger.id, avatarItem)
				return newMap
			})
		}
	}

	const handleAdd = () => {
		if (!isEditMode) setIsEditMode(true)
		setEditingBlogger(null)
		setIsCreateDialogOpen(true)
	}

	const handleSaveBlogger = (updatedBlogger: Blogger, avatarItem?: AvatarItem) => {
		if (editingBlogger) {
			const updated = bloggers.map(blogger => (blogger.id === editingBlogger.id ? updatedBlogger : blogger))
			setBloggers(updated)
		} else {
			setBloggers([...bloggers, updatedBlogger])
		}
		if (avatarItem) {
			setAvatarItems(prev => {
				const newMap = new Map(prev)
				newMap.set(updatedBlogger.id, avatarItem)
				return newMap
			})
		}
	}

	const handleDelete = (blogger: Blogger) => {
		if (confirm(`确定要删除 ${blogger.name} 吗？`)) {
			setBloggers(bloggers.filter(item => item.id !== blogger.id))
		}
	}

	const handleSave = async () => {
		setIsSaving(true)

		try {
			const savedBloggers = await pushBloggers({
				bloggers,
				avatarItems
			})

			await mutateBloggers(savedBloggers, { revalidate: false })
			setBloggers(savedBloggers)
			setOriginalBloggers(savedBloggers)
			setAvatarItems(new Map())
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
		setBloggers(originalBloggers)
		setAvatarItems(new Map())
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
						bloggers={bloggers}
						isEditMode={isEditMode}
						onUpdate={handleUpdate}
						onDelete={handleDelete}
						getLikeState={getLikeState}
						onLikeStateChange={updateLikeState}
						readOnlyLike={canManage}
						className='w-full'
					/>
					{hasMore && !isEditMode && <div className='text-secondary py-6 text-center text-sm'>{isLoadingMore ? '加载更多博主中...' : '继续向下滚动加载更多'}</div>}
				</div>
			</div>

			{!isStudioView && <div className='mx-auto mt-6 w-full max-w-[980px] px-6 pb-6'><CommentBoard targetType='blogger' targetId='bloggers' title='博客博主留言板' /></div>}
			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						{isStudioView && <CommentBoard targetType='blogger' targetId='bloggers' title='博客博主留言板' adminMode className='z-30' />}
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
							{isStudioView && <CommentBoard targetType='blogger' targetId='bloggers' title='博客博主留言板' adminMode className='z-30' />}
							<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsEditMode(true)} className='surface-btn px-6'>编辑</motion.button>
						</>
					)
				)}
			</motion.div>

			{isCreateDialogOpen && <CreateDialog blogger={editingBlogger} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveBlogger} />}
		</>
	)
}
