import { headers } from 'next/headers'
import { listAuditLogs } from '@/lib/server/admin/audit'
import { evaluateAdminHeaders } from '@/lib/server/admin/auth'

function formatDate(value: string) {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return new Intl.DateTimeFormat('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZone: 'Asia/Hong_Kong'
	}).format(date)
}

function formatPayload(payloadJson?: string) {
	if (!payloadJson) return '无附加信息'

	try {
		const parsed = JSON.parse(payloadJson)
		const text = JSON.stringify(parsed, null, 2)
		return text.length > 240 ? `${text.slice(0, 240)}…` : text
	} catch {
		return payloadJson.length > 240 ? `${payloadJson.slice(0, 240)}…` : payloadJson
	}
}

export default async function StudioAuditPage() {
	const headerStore = await headers()
	const access = await evaluateAdminHeaders(headerStore, process.env.ADMIN_ALLOWLIST)
	const logs = await listAuditLogs(80)

	return (
		<div className='space-y-6'>
			<section className='bg-card rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
				<div className='flex flex-wrap items-start justify-between gap-4'>
					<div className='space-y-3'>
						<p className='text-secondary text-xs uppercase tracking-[0.24em]'>Audit</p>
						<h2 className='text-2xl font-semibold'>后台审计日志</h2>
						<p className='text-secondary max-w-3xl leading-7'>
							这里汇总后台保存、删除、上传等关键写操作，方便确认当前管理工作区的活动轨迹，也为后续角色化权限和 AI 工作流接入提供追溯基础。
						</p>
					</div>
					<div className='grid min-w-[280px] gap-3 sm:grid-cols-3'>
						<div className='rounded-2xl border bg-white/55 px-4 py-3'>
							<div className='text-secondary text-xs'>当前邮箱</div>
							<div className='mt-1 text-sm font-medium'>{access.email || 'local-dev'}</div>
						</div>
						<div className='rounded-2xl border bg-white/55 px-4 py-3'>
							<div className='text-secondary text-xs'>当前角色</div>
							<div className='mt-1 text-sm font-medium'>{access.role || 'owner'}</div>
						</div>
						<div className='rounded-2xl border bg-white/55 px-4 py-3'>
							<div className='text-secondary text-xs'>权限来源</div>
							<div className='mt-1 text-sm font-medium'>{access.source || access.reason || 'unknown'}</div>
						</div>
					</div>
				</div>
			</section>

			<section className='bg-card overflow-hidden rounded-[32px] border shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
				<div className='border-b px-6 py-4'>
					<h3 className='text-lg font-medium'>最近 {logs.length} 条后台操作</h3>
				</div>

				{logs.length === 0 ? (
					<div className='text-secondary px-6 py-10 text-sm'>当前还没有审计记录。接下来在后台执行保存、删除或上传操作后，这里就会开始积累日志。</div>
				) : (
					<div className='overflow-x-auto'>
						<table className='min-w-full text-left text-sm'>
							<thead className='bg-white/45 text-secondary'>
								<tr>
									<th className='px-6 py-4 font-medium'>时间</th>
									<th className='px-6 py-4 font-medium'>操作</th>
									<th className='px-6 py-4 font-medium'>目标</th>
									<th className='px-6 py-4 font-medium'>操作者</th>
									<th className='px-6 py-4 font-medium'>附加信息</th>
								</tr>
							</thead>
							<tbody>
								{logs.map(log => (
									<tr key={log.id} className='border-t align-top'>
										<td className='px-6 py-4 whitespace-nowrap'>{formatDate(log.createdAt)}</td>
										<td className='px-6 py-4'>
											<div className='font-medium'>{log.action}</div>
										</td>
										<td className='px-6 py-4'>
											<div>{log.targetType}</div>
											{log.targetId && <div className='text-secondary mt-1 text-xs'>{log.targetId}</div>}
										</td>
										<td className='px-6 py-4 whitespace-nowrap'>{log.actorEmail || 'unknown'}</td>
										<td className='px-6 py-4'>
											<pre className='text-secondary max-w-[520px] overflow-hidden whitespace-pre-wrap break-all font-mono text-xs leading-6'>
												{formatPayload(log.payloadJson)}
											</pre>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	)
}
