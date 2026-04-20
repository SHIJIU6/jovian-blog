'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function Page() {
	const { data: remoteProjects } = useProjectsContent()
	const [projects, setProjects] = useState<Project[]>([])
	const [originalProjects, setOriginalProjects] = useState<Project[]>([])
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [editingProject, setEditingProject] = useState<Project | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const canManage = useManagementMode()

	useEffect(() => {
		if (!remoteProjects || isEditMode) return
		setProjects(remoteProjects)
		setOriginalProjects(remoteProjects)
	}, [remoteProjects, isEditMode])

	const projectLikeKeys = useMemo(() => projects.map(project => buildLikeTargetKey(project.id, 'project')).filter(Boolean), [projects])
	const { getLikeState, updateLikeState } = useBatchLikes(projectLikeKeys)

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
		setEditingProject(null)
		setIsCreateDialogOpen(true)
	}

	const handleSaveProject = (updatedProject: Project) => {
		if (editingProject) {
			const updated = projects.map(project => (project.id === editingProject.id ? updatedProject : project))
			setProjects(updated)
		} else {
			setProjects([...projects, updatedProject])
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
			await pushProjects({
				projects,
				imageItems
			})

			setOriginalProjects(projects)
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
			<div className='flex flex-col items-center justify-center px-6 pt-32 pb-12'>
				<div className='grid w-full max-w-[1200px] grid-cols-2 gap-6 max-md:grid-cols-1'>
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
			</div>

			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
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
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setIsEditMode(true)}
							className='surface-btn px-6'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>

			{isCreateDialogOpen && <CreateDialog project={editingProject} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveProject} />}
		</>
	)
}
