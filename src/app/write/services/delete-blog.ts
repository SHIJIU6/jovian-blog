export async function deleteBlog(slug: string): Promise<void> {
	if (!slug) throw new Error('需要 slug')

	const response = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
		method: 'DELETE'
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(payload.error || '删除失败')
	}
}
