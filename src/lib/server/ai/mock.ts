import { slugify } from '@/lib/markdown-renderer'
import type { AiDraftResult, AiResearchResult, GenerateDraftInput, ResearchTopicInput } from './types'

function normalizeTopic(input: string) {
	return input.trim() || '未命名主题'
}

function buildMockSources(topic: string) {
	return [
		{
			title: `${topic}（本地模拟来源）`,
			url: 'https://example.com/mock-source',
			note: '当前处于本地 mock 模式，请在接入真实模型后替换为正式来源。'
		}
	]
}

export function mockResearchTopic(input: ResearchTopicInput): AiResearchResult {
	const topic = normalizeTopic(input.topic)
	const angle = input.angle?.trim() || `从趋势、影响和落地场景三个维度分析 ${topic}`

	return {
		provider: 'mock',
		summary: `这是基于本地 mock 模式生成的研究摘要，用于在未配置 AI 密钥时验证“研究 -> 草稿 -> 编辑”链路。主题聚焦于 ${topic}。`,
		angle,
		bulletPoints: [
			`${topic} 最近为何值得关注`,
			`${topic} 对开发者、产品和内容创作者的实际影响`,
			`${topic} 在未来一段时间内可能出现的方向`
		],
		category: 'AI',
		tags: ['AI', '本地测试', '草稿'],
		sources: buildMockSources(topic)
	}
}

export function mockGenerateDraft(input: GenerateDraftInput): AiDraftResult {
	const topic = normalizeTopic(input.topic)
	const research = input.research ?? mockResearchTopic(input)
	const title = `${topic}：本地 AI 草稿生成示例`
	const slug = slugify(title) || `draft-${Date.now()}`
	const sourcesSection = research.sources.map(item => `- [${item.title}](${item.url})：${item.note}`).join('\n')

	return {
		provider: 'mock',
		title,
		slug,
		summary: `这是一篇基于本地 mock 模式生成的草稿，用于验证 ${topic} 的 AI 生成与后台编辑流程。`,
		category: research.category || 'AI',
		tags: research.tags.length > 0 ? research.tags : ['AI', '草稿'],
		markdown: `## 为什么值得关注\n\n${research.summary}\n\n## 关键观察\n\n${research.bulletPoints.map(point => `- ${point}`).join('\n')}\n\n## 可写作方向\n\n1. 先解释主题背景和为什么最近变得重要。\n2. 再分析它对博客项目、开发工作流或内容生产的实际影响。\n3. 最后补充个人判断与后续观察点。\n\n## 下一步建议\n\n- 将这篇草稿替换为真实研究结论\n- 补充正式来源、截图或案例\n- 人工审核后再发布\n\n## 参考来源\n\n${sourcesSection}`,
		sources: research.sources
	}
}
