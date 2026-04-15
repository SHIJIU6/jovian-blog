import { ContentAuthoringError, CONTENT_AUTHORING_MODULES, type ContentAuthoringModule, type SiteConfigSection } from './structured-authoring'

const SITE_CONFIG_SECTIONS = ['meta', 'theme', 'images', 'social-buttons', 'preferences', 'card-styles'] as const satisfies readonly SiteConfigSection[]

export function parseContentAuthoringModule(value: string): ContentAuthoringModule {
	if ((CONTENT_AUTHORING_MODULES as readonly string[]).includes(value)) {
		return value as ContentAuthoringModule
	}

	throw new ContentAuthoringError('不支持的内容模块', 404)
}

export function parseSiteConfigSection(value: string): SiteConfigSection {
	if ((SITE_CONFIG_SECTIONS as readonly string[]).includes(value)) {
		return value as SiteConfigSection
	}

	throw new ContentAuthoringError('不支持的站点配置 section', 404)
}

export function toAuthoringErrorResponse(error: unknown) {
	if (error instanceof ContentAuthoringError) {
		return Response.json({ error: error.message }, { status: error.status })
	}

	return Response.json(
		{
			error: error instanceof Error ? error.message : 'Internal Server Error'
		},
		{ status: 500 }
	)
}
