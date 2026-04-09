'use client'

export default function Live2DPage() {
	return (
		<div className='mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-24'>
			<div className='bg-card w-full rounded-3xl border p-8 text-center'>
				<h1 className='text-xl font-semibold tracking-tight'>互动角色位已预留</h1>
				<p className='text-secondary mt-3 text-sm leading-7'>
					原仓库中的 Live2D 示例模型已经从模板中移除，避免继续携带示例素材。
				</p>
				<p className='text-secondary mt-2 text-sm leading-7'>
					如果你后续仍然想保留这个能力，可以在这里接入你自己的 Live2D、Mascot 或任意互动组件。
				</p>
			</div>
		</div>
	)
}
