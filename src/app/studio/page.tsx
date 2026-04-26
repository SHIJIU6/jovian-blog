import Link from 'next/link'

const sections = [
	{
		title: '站点配置',
		description: '管理首页卡片、配色、社交链接、头像、背景与站点元信息。',
		href: '/studio/site'
	},
	{
		title: '文章与发布',
		description: '创建文章、编辑现有内容、管理分类，并为后续 AI 草稿生成预留入口。',
		href: '/studio/blog'
	},
	{
		title: '资源与资料',
		description: '维护项目、资源分享、博主收藏、图片与短句等结构化内容。',
		href: '/studio/projects'
	},
	{
		title: '资源分享',
		description: '维护推荐分享和资源卡片，进入后可直接添加新资源。',
		href: '/studio/share'
	},
	{
		title: '博客博主',
		description: '维护优秀博主列表，进入后可直接添加新博主。',
		href: '/studio/bloggers'
	},
	{
		title: '审计与访问',
		description: '查看后台写操作记录，确认当前权限来源，并为后续角色化管理做准备。',
		href: '/studio/audit'
	}
]

const quickActions = [
	{ label: '写新文章', href: '/studio/write' },
	{ label: '文章管理', href: '/studio/blog' },
	{ label: '添加项目', href: '/studio/projects' },
	{ label: '添加资源', href: '/studio/share' },
	{ label: '添加博主', href: '/studio/bloggers' },
	{ label: '首页配置', href: '/studio/site' },
	{ label: '审计日志', href: '/studio/audit' },
	{ label: '返回前台', href: '/' }
]

export default function StudioHomePage() {
	return (
		<div className='space-y-6'>
			<section className='bg-card space-y-4 rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
				<p className='text-secondary text-xs uppercase tracking-[0.24em]'>Overview</p>
				<h2 className='text-2xl font-semibold'>轻量后台信息架构</h2>
				<p className='text-secondary max-w-3xl leading-7'>
					当前后台以最小改动复用现有 CRUD 页面：前台只展示，后台统一承接文章、项目、资源、博主、图片和站点配置。后续若接入 AI
					生成草稿、审核流和发布流，也建议继续挂在这里。
				</p>
			</section>

			<section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
				{sections.map(section => (
					<Link
						key={section.href}
						href={section.href}
						className='bg-card block space-y-3 rounded-[28px] border p-5 shadow-[0_24px_36px_-28px_rgba(0,0,0,0.08)] transition-transform hover:-translate-y-0.5 hover:bg-white/55'>
						<h3 className='text-lg font-medium'>{section.title}</h3>
						<p className='text-secondary text-sm leading-7'>{section.description}</p>
					</Link>
				))}
			</section>

			<section className='bg-card space-y-4 rounded-[32px] border p-6 shadow-[0_30px_45px_-30px_rgba(0,0,0,0.08)] backdrop-blur'>
				<h3 className='text-lg font-medium'>快捷入口</h3>
				<div className='flex flex-wrap gap-3'>
					{quickActions.map(action => (
						<Link key={action.href} href={action.href} className='rounded-xl border bg-white/60 px-4 py-2 text-sm transition-colors hover:bg-white/80'>
							{action.label}
						</Link>
					))}
				</div>
			</section>
		</div>
	)
}
