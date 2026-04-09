'use client'

export default function Page() {
	return (
		<div className='mx-auto max-w-3xl space-y-4 px-4 py-24'>
			<h1 className='text-xl font-semibold tracking-tight'>自定义功能预留页</h1>
			<p className='text-secondary text-sm'>
				这个页面原本是一个具体场景的示例工具页，已经被清理成模板状态。
			</p>
			<div className='bg-card space-y-3 rounded-xl border p-5 text-sm leading-7'>
				<p>你可以把它继续改造成任意自定义页面，例如：</p>
				<ul className='text-secondary list-inside list-disc space-y-1'>
					<li>AI 研究结果调试页</li>
					<li>文章生成草稿预览页</li>
					<li>接口联调工具页</li>
					<li>内部运营面板或数据分析页</li>
				</ul>
				<p className='text-secondary'>
					如果暂时不需要，也可以后续直接删除这个路由。
				</p>
			</div>
		</div>
	)
}
