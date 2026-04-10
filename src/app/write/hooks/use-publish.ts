import { useCallback } from 'react'
import { toast } from 'sonner'
import { pushBlog } from '../services/push-blog'
import { deleteBlog } from '../services/delete-blog'
import { useWriteStore } from '../stores/write-store'
import { getBlogStatusLabel } from '@/lib/blog-status'

export function usePublish() {
	const { loading, setLoading, form, cover, images, mode, originalSlug, updateForm } = useWriteStore()

	const persistWithStatus = useCallback(
		async (status: 'draft' | 'published' | 'offline') => {
			try {
				setLoading(true)
				await pushBlog({
					form: {
						...form,
						status,
						hidden: status !== 'published'
					},
					cover,
					images,
					mode,
					originalSlug
				})
				updateForm({
					status,
					hidden: status !== 'published'
				})
				const successMsg = mode === 'edit' ? `文章已更新为${getBlogStatusLabel(status)}` : status === 'published' ? '发布成功' : '草稿已保存'
				toast.success(successMsg)
			} catch (err: any) {
				console.error(err)
				toast.error(err?.message || '操作失败')
			} finally {
				setLoading(false)
			}
		},
		[cover, form, images, mode, originalSlug, setLoading, updateForm]
	)

	const onPublish = useCallback(async () => {
		await persistWithStatus('published')
	}, [persistWithStatus])

	const onSaveDraft = useCallback(async () => {
		await persistWithStatus('draft')
	}, [persistWithStatus])

	const onOffline = useCallback(async () => {
		await persistWithStatus('offline')
	}, [persistWithStatus])

	const onDelete = useCallback(async () => {
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('缺少 slug，无法删除')
			return
		}
		try {
			setLoading(true)
			await deleteBlog(targetSlug)
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '删除失败')
		} finally {
			setLoading(false)
		}
	}, [form.slug, originalSlug, setLoading])

	return {
		loading,
		onPublish,
		onSaveDraft,
		onOffline,
		onDelete
	}
}
