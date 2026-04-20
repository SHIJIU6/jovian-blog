'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const studioLinks = [
	{ href: '/studio', label: '概览' },
	{ href: '/studio/site', label: '站点配置' },
	{ href: '/studio/write', label: '写文章' },
	{ href: '/studio/blog', label: '文章管理' },
	{ href: '/studio/projects', label: '项目' },
	{ href: '/studio/share', label: '资源' },
	{ href: '/studio/bloggers', label: '博主' },
	{ href: '/studio/pictures', label: '图片' },
	{ href: '/studio/snippets', label: '短句' },
	{ href: '/studio/audit', label: '审计日志' },
	{ href: '/', label: '返回前台' }
]

export function StudioShell({ children }: Readonly<{ children: React.ReactNode }>) {
	const pathname = usePathname()

	return (
		<div className='px-6 pt-24 pb-12 max-sm:px-4 max-sm:pt-20'>
			<div className='mx-auto grid w-full max-w-[1480px] grid-cols-[260px_minmax(0,1fr)] items-start gap-6 max-lg:grid-cols-1'>
				<aside className='bg-card sticky top-24 h-fit w-full shrink-0 space-y-4 rounded-[32px] border p-5 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur max-lg:static'>
					<div>
						<p className='text-secondary text-xs uppercase tracking-[0.24em]'>Studio</p>
						<h1 className='mt-2 text-xl font-semibold'>轻量后台</h1>
						<p className='text-secondary mt-2 text-sm leading-6'>统一收纳站点设置和现有 CRUD 能力，前台只保留展示。</p>
					</div>

					<nav className='space-y-2'>
						{studioLinks.map(item => {
							const active = pathname === item.href || (item.href !== '/studio' && pathname.startsWith(`${item.href}/`))
							return (
								<Link
									key={item.href}
									href={item.href}
									className={cn(
										'flex items-center rounded-2xl px-3 py-2.5 text-sm transition-all',
										active
											? 'border bg-[linear-gradient(to_right_bottom,var(--color-border)_60%,var(--color-card)_100%)] text-primary font-medium'
											: 'text-secondary hover:bg-[var(--surface-hover)]'
									)}>
									{item.label}
								</Link>
							)
						})}
					</nav>
				</aside>

				<div className='min-w-0 flex-1 space-y-6'>{children}</div>
			</div>
		</div>
	)
}
