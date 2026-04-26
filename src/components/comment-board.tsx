'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Mail, MessageCircle, Search, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import type { CommentItem, CommentTargetType } from '@/lib/comment-types'

type CommentBoardProps = {
	targetType: CommentTargetType
	targetId: string
	title?: string
	className?: string
	adminMode?: boolean
}

type CommentResponse = {
	items: CommentItem[]
	page?: number
	pageSize?: number
	hasMore?: boolean
}

const fetcher = async (url: string): Promise<CommentResponse> => {
	const response = await fetch(url, { cache: 'no-store' })
	if (!response.ok) throw new Error('Failed to load comments')
	return response.json()
}

function formatTime(value: string) {
	if (!value) return ''
	return new Date(value).toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	})
}

function statusLabel(status: CommentItem['status']) {
	const labels: Record<CommentItem['status'], string> = {
		pending: '待审核',
		approved: '已公开',
		spam: '已隐藏',
		deleted: '已删除'
	}
	return labels[status] || status
}

export function CommentBoard({ targetType, targetId, title = '留言板', className, adminMode = false }: CommentBoardProps) {
	const [open, setOpen] = useState(false)
	const [collapsed, setCollapsed] = useState(false)
	const [selectedComment, setSelectedComment] = useState<CommentItem | null>(null)
	const [query, setQuery] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const [page, setPage] = useState(1)
	const pageSize = adminMode ? 8 : 6
	const endpoint = useMemo(
		() =>
			targetId ? `${adminMode ? '/api/admin/comments' : '/api/comments'}?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}&status=all&page=${page}&pageSize=${pageSize}&query=${encodeURIComponent(debouncedQuery)}` : '',
		[adminMode, debouncedQuery, page, pageSize, targetId, targetType]
	)
	const { data, mutate, isLoading } = useSWR(endpoint || null, fetcher, { revalidateOnFocus: false })
	const [authorName, setAuthorName] = useState('')
	const [authorEmail, setAuthorEmail] = useState('')
	const [authorUrl, setAuthorUrl] = useState('')
	const [content, setContent] = useState('')
	const [website, setWebsite] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [updatingId, setUpdatingId] = useState('')

	const comments = data?.items || []
	const hasMore = Boolean(data?.hasMore)

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setPage(1)
			setDebouncedQuery(query.trim())
		}, 250)
		return () => window.clearTimeout(timer)
	}, [query])

	const updateStatus = async (comment: CommentItem, status: CommentItem['status']) => {
		if (!adminMode || updatingId) return
		setUpdatingId(comment.id)
		try {
			const response = await fetch(`/api/admin/comments/${encodeURIComponent(comment.id)}`, {
				method: status === 'deleted' ? 'DELETE' : 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: status === 'deleted' ? undefined : JSON.stringify({ status })
			})
			const payload = await response.json().catch(() => ({}))
			if (!response.ok) throw new Error(payload?.error || '处理失败')
			await mutate(current => ({ ...current, items: (current?.items || []).map(item => (item.id === comment.id ? payload.item : item)) }), { revalidate: false })
			setSelectedComment(current => (current?.id === comment.id ? payload.item : current))
			toast.success('留言状态已更新')
		} catch (error: any) {
			toast.error(error?.message || '处理失败')
		} finally {
			setUpdatingId('')
		}
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!targetId || submitting) return
		if (website.trim()) return
		if (!content.trim()) {
			toast.error('请先填写留言内容')
			return
		}

		setSubmitting(true)
		try {
			const response = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetType, targetId, authorName, authorEmail, authorUrl, content })
			})
			const payload = await response.json().catch(() => ({}))
			if (!response.ok) throw new Error(payload?.error || '留言提交失败')

			if (payload?.item?.status === 'approved') {
				setPage(1)
				await mutate()
				toast.success('留言成功')
			} else {
				toast.success('留言已提交，审核后显示')
			}

			setAuthorName('')
			setAuthorEmail('')
			setAuthorUrl('')
			setContent('')
		} catch (error: any) {
			toast.error(error?.message || '留言提交失败')
		} finally {
			setSubmitting(false)
		}
	}

	const searchBox = (
		<label className='flex items-center gap-2 rounded-full border bg-[var(--surface-input)] px-3 py-2'>
			<Search className='h-4 w-4 text-secondary' />
			<input value={query} onChange={event => setQuery(event.target.value)} placeholder={adminMode ? '搜索昵称、邮箱、网站、内容...' : '搜索留言内容...'} className='w-full bg-transparent text-sm outline-none' />
		</label>
	)

	const pager = (
		<div className='mt-3 flex items-center justify-end gap-2'>
			<button type='button' disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className='surface-btn p-2 disabled:opacity-40'><ChevronLeft className='h-4 w-4' /></button>
			<span className='text-secondary text-xs'>第 {page} 页</span>
			<button type='button' disabled={!hasMore} onClick={() => setPage(current => current + 1)} className='surface-btn p-2 disabled:opacity-40'><ChevronRight className='h-4 w-4' /></button>
		</div>
	)

	const publicCommentList = (
		<div>
			{isLoading && <p className='text-secondary text-xs'>留言加载中...</p>}
			{!isLoading && comments.length === 0 && <p className='text-secondary text-xs'>还没有留言，来写第一条吧。</p>}
			<div className='space-y-2'>
				{comments.map(comment => (
					<article key={comment.id} className='rounded-xl border bg-[var(--surface-soft)] px-3 py-2 shadow-sm'>
						<div className='mb-1 flex items-center justify-between gap-3'>
							<span className='truncate text-xs font-semibold text-primary'>{comment.authorName}</span>
							<time className='shrink-0 text-[11px] text-secondary'>{formatTime(comment.createdAt)}</time>
						</div>
						<p className='line-clamp-2 break-words text-xs leading-5 text-secondary'>{comment.content}</p>
					</article>
				))}
			</div>
			{(page > 1 || hasMore) && pager}
		</div>
	)

	const commentList = (
		<div>
			{isLoading && <p className='text-secondary text-sm'>留言加载中...</p>}
			{!isLoading && comments.length === 0 && <p className='text-secondary text-sm'>{adminMode ? '当前模块还没有留言。' : '还没有留言，来写第一条吧。'}</p>}
			<div className='space-y-3'>
				{comments.map(comment => (
					<article key={comment.id} className='rounded-2xl border bg-[var(--surface-soft)] p-3 shadow-sm'>
						<div className='flex items-start justify-between gap-3'>
							<div className='min-w-0'>
								<div className='truncate text-sm font-semibold text-primary'>{comment.authorName}</div>
								{adminMode && <div className='mt-1 flex items-center gap-1 text-xs text-secondary'><Mail className='h-3.5 w-3.5' />{comment.authorEmail || '未填写邮箱'}</div>}
							</div>
							<time className='text-xs text-secondary'>{formatTime(comment.createdAt)}</time>
						</div>
						<p className='line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-secondary'>{comment.content}</p>
						{adminMode && (
							<div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
								<span className='surface-chip text-xs'>{statusLabel(comment.status)}</span>
								<div className='flex flex-wrap gap-2'>
									<button type='button' onClick={() => setSelectedComment(comment)} className='surface-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs'><Eye className='h-3.5 w-3.5' />详情</button>
									{comment.status !== 'approved' && <button type='button' onClick={() => updateStatus(comment, 'approved')} disabled={updatingId === comment.id} className='surface-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs'><CheckCircle2 className='h-3.5 w-3.5' />公开</button>}
									{comment.status !== 'spam' && <button type='button' onClick={() => updateStatus(comment, 'spam')} disabled={updatingId === comment.id} className='surface-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs'><EyeOff className='h-3.5 w-3.5' />隐藏</button>}
									{comment.status !== 'deleted' && <button type='button' onClick={() => updateStatus(comment, 'deleted')} disabled={updatingId === comment.id} className='surface-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs text-red-600'><Trash2 className='h-3.5 w-3.5' />删除</button>}
								</div>
							</div>
						)}
					</article>
				))}
			</div>
			{pager}
		</div>
	)

	const publicBoard = (
		<section className='card !relative w-full overflow-hidden p-0'>
			<button type='button' onClick={() => setCollapsed(current => !current)} className='flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left'>
				<span className='inline-flex items-center gap-2 text-base font-semibold text-primary'><MessageCircle className='h-4 w-4' />{title}</span>
				<span className='surface-chip inline-flex items-center gap-1 text-xs'>{collapsed ? '展开留言' : '收起留言'}{collapsed ? <ChevronDown className='h-3.5 w-3.5' /> : <ChevronUp className='h-3.5 w-3.5' />}</span>
			</button>
			{!collapsed && (
				<div className='grid gap-3 p-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]'>
					<form onSubmit={handleSubmit} className='min-w-0 rounded-2xl border bg-[var(--surface-soft)] p-3'>
						<div>
							<h3 className='text-sm font-semibold text-primary'>写下留言</h3>
							<p className='mt-0.5 text-[11px] text-secondary'>邮箱仅后台可见，前台不会公开展示。</p>
						</div>
						<div className='mt-2 grid grid-cols-2 gap-2 max-sm:grid-cols-1'>
							<input value={authorName} onChange={event => setAuthorName(event.target.value)} maxLength={40} placeholder='昵称（可选）' className='surface-input px-3 py-2 text-sm' />
							<input value={authorEmail} onChange={event => setAuthorEmail(event.target.value)} maxLength={120} placeholder='邮箱（可选，不公开）' className='surface-input px-3 py-2 text-sm' />
						</div>
						<input value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete='off' className='hidden' />
						<textarea value={content} onChange={event => setContent(event.target.value)} maxLength={1000} rows={3} placeholder='想说点什么...' className='surface-input mt-2 h-24 w-full resize-none px-3 py-2 text-sm' />
						<div className='mt-2 flex items-center justify-between gap-3'>
							<span className='text-xs text-secondary'>{content.length}/1000</span>
							<button type='submit' disabled={submitting} className='surface-btn inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50'><Send className='h-4 w-4' />{submitting ? '提交中...' : '提交留言'}</button>
						</div>
					</form>
					<div className='min-w-0 rounded-2xl border bg-[var(--surface-soft)] p-3'>
						<div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
							<div>
								<h3 className='text-sm font-semibold text-primary'>留言列表</h3>
								<p className='mt-0.5 text-[11px] text-secondary'>分页查看公开留言。</p>
							</div>
							<div className='w-full sm:w-64'>{searchBox}</div>
						</div>
						{publicCommentList}
					</div>
				</div>
			)}
		</section>
	)

	if (!adminMode) return publicBoard

	return (
		<>
			<button type='button' onClick={() => setOpen(true)} className={['surface-btn inline-flex items-center gap-2 px-3 py-2 text-sm', className].filter(Boolean).join(' ')}>
				<MessageCircle className='h-4 w-4' />留言板
			</button>

			{open && (
				<DialogModal open onClose={() => setOpen(false)} className='card w-[920px] max-w-[calc(100vw-2rem)] p-0'>
					<div className='flex items-center justify-between border-b px-5 py-4'>
						<div><h3 className='text-lg font-semibold'>{title}</h3><p className='text-sm text-secondary'>查看并处理当前模块留言</p></div>
						<button type='button' onClick={() => setOpen(false)} className='surface-btn p-2'><X className='h-4 w-4' /></button>
					</div>
					<div className='space-y-4 p-5'>
						{searchBox}
						{commentList}
					</div>
				</DialogModal>
			)}

			{selectedComment && (
				<DialogModal open onClose={() => setSelectedComment(null)} className='card w-[620px] max-w-[calc(100vw-2rem)] p-0'>
					<div className='flex items-center justify-between border-b px-5 py-4'><h3 className='text-lg font-semibold'>留言详情</h3><button type='button' onClick={() => setSelectedComment(null)} className='surface-btn p-2'><X className='h-4 w-4' /></button></div>
					<div className='space-y-4 p-5 text-sm'>
						<div className='grid gap-3 md:grid-cols-2'>
							<div><div className='text-xs text-secondary'>留言 ID</div><div className='break-all font-mono'>{selectedComment.id}</div></div>
							<div><div className='text-xs text-secondary'>状态</div><div>{statusLabel(selectedComment.status)}</div></div>
							<div><div className='text-xs text-secondary'>昵称</div><div>{selectedComment.authorName}</div></div>
							<div><div className='text-xs text-secondary'>邮箱</div><div>{selectedComment.authorEmail || '未填写'}</div></div>
							<div><div className='text-xs text-secondary'>网站</div><div className='break-all'>{selectedComment.authorUrl || '未填写'}</div></div>
							<div><div className='text-xs text-secondary'>时间</div><div>{formatTime(selectedComment.createdAt)}</div></div>
							<div><div className='text-xs text-secondary'>IP 哈希</div><div className='break-all font-mono text-xs'>{selectedComment.ipHash || '无'}</div></div>
							<div><div className='text-xs text-secondary'>UA 哈希</div><div className='break-all font-mono text-xs'>{selectedComment.userAgentHash || '无'}</div></div>
						</div>
						<div><div className='mb-2 text-xs text-secondary'>完整内容</div><p className='rounded-2xl border bg-[var(--surface-soft)] p-4 whitespace-pre-wrap break-words leading-7'>{selectedComment.content}</p></div>
						<div className='flex flex-wrap justify-end gap-2'>
							<button type='button' onClick={() => updateStatus(selectedComment, 'approved')} className='surface-btn px-4 py-2 text-sm'>公开</button>
							<button type='button' onClick={() => updateStatus(selectedComment, 'spam')} className='surface-btn px-4 py-2 text-sm'>隐藏</button>
							<button type='button' onClick={() => updateStatus(selectedComment, 'deleted')} className='surface-btn px-4 py-2 text-sm text-red-600'>删除</button>
						</div>
					</div>
				</DialogModal>
			)}
		</>
	)
}
