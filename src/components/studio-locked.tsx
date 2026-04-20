export function StudioLocked({ reason }: { reason?: string }) {
	return (
		<div className='px-6 pt-24 pb-12 max-sm:px-4 max-sm:pt-20'>
			<div className='mx-auto max-w-3xl'>
				<div className='bg-card space-y-4 rounded-[32px] border p-8 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
					<p className='text-secondary text-xs uppercase tracking-[0.24em]'>Studio</p>
					<h1 className='text-2xl font-semibold'>后台当前不可访问</h1>
					<p className='text-secondary leading-7'>
						线上建议使用 Cloudflare Access 保护 `/studio/*`。应用层会优先读取 D1 `admins` 表判断角色；若管理员表尚未初始化，再回退到
						`ADMIN_ALLOWLIST`。
					</p>
					<div className='rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm text-secondary'>
						当前状态：{reason || 'unauthorized'}
					</div>
					<ul className='text-secondary list-inside list-disc space-y-1 text-sm leading-7'>
						<li>本地开发：`localhost / 127.0.0.1` 默认放行</li>
						<li>线上部署：配置 Cloudflare Access，并确保请求头带有 `Cf-Access-Authenticated-User-Email`</li>
						<li>推荐在 D1 `admins` 表中维护管理员角色；过渡阶段可继续设置 `ADMIN_ALLOWLIST=user@example.com`</li>
					</ul>
				</div>
			</div>
		</div>
	)
}
