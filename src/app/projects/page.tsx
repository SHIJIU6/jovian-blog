'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { ProjectCard, type Project } from './components/project-card'
import CreateDialog from './components/create-dialog'
import { pushProjects } from './services/push-projects'
import type { ImageItem } from './components/image-upload-dialog'
import { useManagementMode } from '@/hooks/use-management-mode'
import { useProjectsContent } from '@/hooks/use-structured-content'
import { buildLikeTargetKey } from '@/lib/like-target'
import { useBatchLikes } from '@/hooks/use-batch-likes'
import { CommentBoard } from '@/components/comment-board'
import { useAutoLoadMore } from '@/hooks/use-auto-load-more'
import { usePathname } from 'next/navigation'

export default function Page() {
	const { data: remoteProjects, mutate: mutateProjects, hasMore, loadMore, isLoadingMore } = useProjectsContent()
	const [projects, setProjects] = useState<Project[]>([])
	const [originalProjects, setOriginalProjects] = useState<Project[]>([])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [editingProject, setEditingProject] = useState<Project | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const listScrollRef = useRef<HTMLDivElement>(null)
	const canManage = useManagementMode()
	const isStudioView = usePathname().startsWith('/studio')

	useEffect(() => {
		if (!remoteProjects || isEditMode) return
		setProjects(remoteProjects)
		setOriginalProjects(remoteProjects)
	}, [remoteProjects, isEditMode])

	const projectLikeKeys = useMemo(() => projects.map(project => buildLikeTargetKey(project.id, 'project')).filter(Boolean), [projects])
	const { getLikeState, updateLikeState } = useBatchLikes(projectLikeKeys)
	useAutoLoadMore({ hasMore, isLoading: isLoadingMore || isEditMode, enabled: !isEditMode, rootRef: listScrollRef, loadMore })

	const handleUpdate = (updatedProject: Project, oldProject: Project, imageItem?: ImageItem) => {
		setProjects(prev => prev.map(project => (project.id === oldProject.id ? updatedProject : project)))
		if (imageItem) {
			setImageItems(prev => {
				const newMap = new Map(prev)
				newMap.set(updatedProject.id, imageItem)
				return newMap
			})
		}
	}

	const handleAdd = () => {
		if (!isEditMode) setIsEditMode(true)
		setEditingProject(null)
		setIsCreateDialogOpen(true)
	}

	const handleSaveProject = (updatedProject: Project, imageItem?: ImageItem) => {
		if (editingProject) {
			const updated = projects.map(project => (project.id === editingProject.id ? updatedProject : project))
			setProjects(updated)
		} else {
			setProjects([...projects, updatedProject])
		}
		if (imageItem) {
			setImageItems(prev => {
				const newMap = new Map(prev)
				newMap.set(updatedProject.id, imageItem)
				return newMap
			})
		}
	}

	const handleDelete = (project: Project) => {
		if (confirm(`确定要删除 ${project.name} 吗？`)) {
			setProjects(projects.filter(item => item.id !== project.id))
		}
	}

	const handleSave = async () => {
		setIsSaving(true)

		try {
			const savedProjects = await pushProjects({
				projects,
				imageItems
			})

			await mutateProjects(savedProjects, { revalidate: false })
			setProjects(savedProjects)
			setOriginalProjects(savedProjects)
			setImageItems(new Map())
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
		setProjects(originalProjects)
		setImageItems(new Map())
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
			<div className='flex min-h-screen flex-col items-center px-6 pt-32 pb-6'>
				<div className='flex min-h-[calc(100vh-8rem)] w-full flex-col items-center'>
					<div ref={listScrollRef} className='h-[calc(100vh-18rem)] min-h-[360px] w-full max-w-[1200px] overflow-y-auto overflow-x-hidden pr-2'>
						<div className='grid w-full grid-cols-2 gap-6 max-md:grid-cols-1'>
							{projects.map(project => {
								const likeTargetKey = buildLikeTargetKey(project.id, 'project')
								return (
									<ProjectCard
										key={project.id}
										project={project}
										isEditMode={isEditMode}
										onUpdate={handleUpdate}
										onDelete={() => handleDelete(project)}
										likeTargetKey={likeTargetKey}
										likeState={getLikeState(likeTargetKey)}
										onLikeStateChange={nextState => updateLikeState(likeTargetKey, nextState)}
										readOnlyLike={canManage}
									/>
								)
							})}
						</div>
						{hasMore && !isEditMode && <div className='text-secondary py-6 text-center text-sm'>{isLoadingMore ? '加载更多项目中...' : '继续向下滚动加载更多'}</div>}
					</div>
					{!isStudioView && <div className='mt-auto w-full max-w-[1200px] pt-12'><CommentBoard targetType='project' targetId='projects' title='项目留言板' /></div>}
				</div>
			</div>

			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						{isStudioView && <CommentBoard targetType='project' targetId='projects' title='项目留言板' adminMode className='z-30' />}
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
							{isStudioView && <CommentBoard targetType='project' targetId='projects' title='项目留言板' adminMode className='z-30' />}
							<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsEditMode(true)} className='surface-btn px-6'>编辑</motion.button>
						</>
					)
				)}
			</motion.div>

			{isCreateDialogOpen && <CreateDialog project={editingProject} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveProject} />}
		</>
	)
}
