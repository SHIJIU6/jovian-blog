import { readFileSync } from 'node:fs'
import { createAdminApiClient } from './mcp-runtime.mjs'
import { createEnvelopeSchema, createSummarySchema, createToolRegistry, defineTool } from './mcp-tooling.mjs'

export const CONTENT_MCP_SERVER_INFO = {
  name: '2025-content-admin',
  title: '2025 Blog Content Admin',
  version: '0.3.0'
}

export const CONTENT_MCP_SERVER_INSTRUCTIONS =
  'Use this server only for the 2025-blog-public repository. Read before write, resolve the stable id before update or delete, keep media URL-first, and verify every successful write with a follow-up read.'

const moduleContract = JSON.parse(
  readFileSync(new URL('../src/lib/content-authoring-contract.json', import.meta.url), 'utf8')
)

const listSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Optional keyword query.' },
    limit: { type: 'number', description: 'Optional list limit.' }
  },
  additionalProperties: false
}

const idSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Stable item id.' }
  },
  required: ['id'],
  additionalProperties: false
}

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
}

const imageItemArraySchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      url: { type: 'string' }
    },
    required: ['url'],
    additionalProperties: false
  }
}

const socialButtonsSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string' },
      value: { type: 'string' },
      label: { type: 'string' },
      order: { type: 'number' }
    },
    required: ['type', 'value'],
    additionalProperties: false
  }
}

const cardStylesSchema = {
  type: 'object',
  additionalProperties: {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      order: { type: 'number' },
      offset: { type: ['number', 'null'] },
      offsetX: { type: ['number', 'null'] },
      offsetY: { type: ['number', 'null'] },
      enabled: { type: 'boolean' }
    },
    additionalProperties: false
  }
}

const siteConfigSchema = {
  type: 'object',
  additionalProperties: true
}

const aboutSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    content: { type: 'string' }
  },
  required: ['title', 'description', 'content'],
  additionalProperties: false
}

const siteMetaSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    username: { type: 'string' }
  },
  additionalProperties: false
}

const siteThemeSchema = {
  type: 'object',
  properties: {
    colorBrand: { type: 'string' },
    colorPrimary: { type: 'string' },
    colorSecondary: { type: 'string' },
    colorBrandSecondary: { type: 'string' },
    colorBg: { type: 'string' },
    colorBorder: { type: 'string' },
    colorCard: { type: 'string' },
    colorArticle: { type: 'string' }
  },
  additionalProperties: false
}

const siteImagesSchema = {
  type: 'object',
  properties: {
    faviconUrl: { type: 'string' },
    avatarUrl: { type: 'string' },
    artImages: imageItemArraySchema,
    currentArtImageId: { type: 'string' },
    backgroundImages: imageItemArraySchema,
    currentBackgroundImageId: { type: 'string' }
  },
  additionalProperties: false
}

const sitePreferencesSchema = {
  type: 'object',
  properties: {
    backgroundColors: { type: 'array', items: { type: 'string' } },
    clockShowSeconds: { type: 'boolean' },
    summaryInContent: { type: 'boolean' },
    enableHat: { type: 'boolean' },
    hatOffsetX: { type: ['number', 'null'] },
    hatOffsetY: { type: ['number', 'null'] },
    hatScale: { type: ['number', 'null'] },
    isCachePem: { type: 'boolean' },
    hideEditButton: { type: 'boolean' },
    enableCategories: { type: 'boolean' },
    currentHatIndex: { type: 'number' },
    hatFlipped: { type: 'boolean' },
    enableChristmas: { type: 'boolean' },
    beian: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        link: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
}

const moduleConfigs = Object.entries(moduleContract).map(([plural, contract]) => ({
  plural,
  ...contract
}))

function createModuleSummarySchema() {
  return createSummarySchema({
    module: { type: 'string' },
    action: { type: 'string' },
    total: { type: 'number' },
    position: { type: 'number' },
    query: { type: 'string' }
  })
}

function createModuleListOutputSchema(config) {
  return createEnvelopeSchema(
    {
      items: {
        type: 'array',
        items: config.itemSchema
      },
      summary: createModuleSummarySchema()
    },
    ['items', 'summary']
  )
}

function createModuleItemOutputSchema(config) {
  return createEnvelopeSchema(
    {
      item: config.itemSchema,
      position: { type: 'number' },
      summary: createModuleSummarySchema()
    },
    ['item', 'position', 'summary']
  )
}

function createModuleDeleteOutputSchema(config) {
  return createEnvelopeSchema(
    {
      id: { type: 'string' },
      item: config.itemSchema,
      summary: createModuleSummarySchema()
    },
    ['id', 'item', 'summary']
  )
}

function createSiteConfigOutputSchema() {
  return createEnvelopeSchema(
    {
      siteContent: siteConfigSchema,
      cardStyles: cardStylesSchema,
      summary: createSummarySchema({
        sections: {
          type: 'array',
          items: { type: 'string' }
        }
      })
    },
    ['siteContent', 'cardStyles', 'summary']
  )
}

function createSiteConfigSectionOutputSchema() {
  return createEnvelopeSchema(
    {
      section: { type: 'string' },
      value: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
      siteContent: siteConfigSchema,
      cardStyles: cardStylesSchema,
      summary: createSummarySchema({
        section: { type: 'string' }
      })
    },
    ['section', 'value', 'siteContent', 'cardStyles', 'summary']
  )
}

function createAboutOutputSchema() {
  return createEnvelopeSchema(
    {
      about: aboutSchema,
      summary: createSummarySchema({
        title: { type: 'string' }
      })
    },
    ['about', 'summary']
  )
}

function summarizeLabel(config, payload) {
  const label =
    payload?.item?.[config.labelField] ||
    payload?.item?.name ||
    payload?.item?.id ||
    payload?.id ||
    config.singular
  return String(label)
}

function buildListPath(config, args) {
  const params = new URLSearchParams()
  if (typeof args.query === 'string' && args.query.trim()) {
    params.set('query', args.query.trim())
  }
  if (Number.isFinite(args.limit)) {
    params.set('limit', String(args.limit))
  }
  const query = params.toString()
  return `/api/admin/content/${config.plural}${query ? `?${query}` : ''}`
}

async function callModuleCrudTool(client, config, action, args = {}) {
  switch (action) {
    case 'list': {
      const payload = await client.requestJson(buildListPath(config, args))
      return {
        summary: `Loaded ${Array.isArray(payload.items) ? payload.items.length : 0} ${config.plural}.`,
        data: payload
      }
    }
    case 'get': {
      const payload = await client.requestJson(
        `/api/admin/content/${config.plural}/${encodeURIComponent(args.id)}`
      )
      return {
        summary: `Loaded ${config.singular} "${summarizeLabel(config, payload)}".`,
        data: payload
      }
    }
    case 'create': {
      const payload = await client.requestJson(`/api/admin/content/${config.plural}`, {
        method: 'POST',
        body: JSON.stringify(args)
      })
      return {
        summary: `Created ${config.singular} "${summarizeLabel(config, payload)}".`,
        data: payload
      }
    }
    case 'update': {
      const { id, ...patch } = args
      const payload = await client.requestJson(
        `/api/admin/content/${config.plural}/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patch)
        }
      )
      return {
        summary: `Updated ${config.singular} "${summarizeLabel(config, payload)}".`,
        data: payload
      }
    }
    case 'delete': {
      const payload = await client.requestJson(
        `/api/admin/content/${config.plural}/${encodeURIComponent(args.id)}`,
        {
          method: 'DELETE'
        }
      )
      return {
        summary: `Deleted ${config.singular} "${summarizeLabel(config, payload)}".`,
        data: payload
      }
    }
    default:
      throw new Error(`Unsupported module action: ${action}`)
  }
}

async function callSiteTool(client, name, args = {}) {
  switch (name) {
    case 'get_site_config': {
      const payload = await client.requestJson('/api/admin/content/site-config')
      return { summary: 'Loaded site config.', data: payload }
    }
    case 'update_site_meta': {
      const payload = await client.requestJson('/api/admin/content/site-config/meta', {
        method: 'PATCH',
        body: JSON.stringify({ meta: args })
      })
      return { summary: 'Updated site meta.', data: payload }
    }
    case 'update_site_theme': {
      const payload = await client.requestJson('/api/admin/content/site-config/theme', {
        method: 'PATCH',
        body: JSON.stringify({ theme: args })
      })
      return { summary: 'Updated site theme.', data: payload }
    }
    case 'update_site_images': {
      const payload = await client.requestJson('/api/admin/content/site-config/images', {
        method: 'PATCH',
        body: JSON.stringify({ images: args })
      })
      return { summary: 'Updated site images.', data: payload }
    }
    case 'update_site_social_buttons': {
      const payload = await client.requestJson(
        '/api/admin/content/site-config/social-buttons',
        {
          method: 'PATCH',
          body: JSON.stringify({ socialButtons: args.socialButtons })
        }
      )
      return {
        summary: `Updated ${Array.isArray(args.socialButtons) ? args.socialButtons.length : 0} social buttons.`,
        data: payload
      }
    }
    case 'update_site_preferences': {
      const payload = await client.requestJson('/api/admin/content/site-config/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ preferences: args })
      })
      return { summary: 'Updated site preferences.', data: payload }
    }
    case 'update_card_styles': {
      const payload = await client.requestJson('/api/admin/content/site-config/card-styles', {
        method: 'PATCH',
        body: JSON.stringify({ cardStyles: args.cardStyles })
      })
      return { summary: 'Updated card styles.', data: payload }
    }
    case 'get_about_page': {
      const payload = await client.requestJson('/api/admin/content/about')
      return {
        summary: `Loaded about page "${payload.about?.title || ''}".`,
        data: payload
      }
    }
    case 'update_about_page': {
      const payload = await client.requestJson('/api/admin/content/about', {
        method: 'PATCH',
        body: JSON.stringify(args)
      })
      return {
        summary: `Updated about page "${payload.about?.title || ''}".`,
        data: payload
      }
    }
    default:
      return null
  }
}

export function createContentMcpToolRegistry(client = createAdminApiClient()) {
  const moduleTools = moduleConfigs.flatMap(config => [
    defineTool({
      name: `list_${config.plural}`,
      title: `List ${config.title}`,
      description: `List ${config.plural} from the admin content API with optional keyword filtering.`,
      inputSchema: listSchema,
      outputSchema: createModuleListOutputSchema(config),
      readOnly: true,
      idempotent: true,
      handler: args => callModuleCrudTool(client, config, 'list', args)
    }),
    defineTool({
      name: `get_${config.singular}`,
      title: `Get ${config.title}`,
      description: `Load a single ${config.singular} by stable id.`,
      inputSchema: idSchema,
      outputSchema: createModuleItemOutputSchema(config),
      readOnly: true,
      idempotent: true,
      handler: args => callModuleCrudTool(client, config, 'get', args)
    }),
    defineTool({
      name: `create_${config.singular}`,
      title: `Create ${config.title}`,
      description: `Create a ${config.singular}. Media fields remain URL-first in this server.`,
      inputSchema: config.createSchema,
      outputSchema: createModuleItemOutputSchema(config),
      destructive: false,
      idempotent: false,
      handler: args => callModuleCrudTool(client, config, 'create', args)
    }),
    defineTool({
      name: `update_${config.singular}`,
      title: `Update ${config.title}`,
      description: `Patch a ${config.singular} by stable id. Resolve the id before calling this tool.`,
      inputSchema: config.updateSchema,
      outputSchema: createModuleItemOutputSchema(config),
      destructive: false,
      idempotent: false,
      handler: args => callModuleCrudTool(client, config, 'update', args)
    }),
    defineTool({
      name: `delete_${config.singular}`,
      title: `Delete ${config.title}`,
      description: `Delete a ${config.singular} by stable id. Only call this after explicit user confirmation.`,
      inputSchema: idSchema,
      outputSchema: createModuleDeleteOutputSchema(config),
      destructive: true,
      idempotent: false,
      handler: args => callModuleCrudTool(client, config, 'delete', args)
    })
  ])

  const siteTools = [
    defineTool({
      name: 'get_site_config',
      title: 'Get Site Config',
      description: 'Read the current site content and card styles.',
      inputSchema: emptyInputSchema,
      outputSchema: createSiteConfigOutputSchema(),
      readOnly: true,
      idempotent: true,
      handler: () => callSiteTool(client, 'get_site_config')
    }),
    defineTool({
      name: 'update_site_meta',
      title: 'Update Site Meta',
      description: 'Patch site meta fields only.',
      inputSchema: siteMetaSchema,
      outputSchema: createSiteConfigSectionOutputSchema(),
      destructive: false,
      idempotent: false,
      handler: args => callSiteTool(client, 'update_site_meta', args)
    }),
    defineTool({
      name: 'update_site_theme',
      title: 'Update Site Theme',
      description: 'Patch site theme colors only.',
      inputSchema: siteThemeSchema,
      outputSchema: createSiteConfigSectionOutputSchema(),
      destructive: false,
      idempotent: false,
      handler: args => callSiteTool(client, 'update_site_theme', args)
    }),
    defineTool({
      name: 'update_site_images',
      title: 'Update Site Images',
      description: 'Patch favicon, avatar, art images, or background images with URL-based values only.',
      inputSchema: siteImagesSchema,
      outputSchema: createSiteConfigSectionOutputSchema(),
      destructive: false,
      idempotent: false,
      handler: args => callSiteTool(client, 'update_site_images', args)
    }),
    defineTool({
      name: 'update_site_social_buttons',
      title: 'Update Site Social Buttons',
      description: 'Replace or patch social buttons without writing unrelated site-config sections.',
      inputSchema: {
        type: 'object',
        properties: {
          socialButtons: socialButtonsSchema
        },
        required: ['socialButtons'],
        additionalProperties: false
      },
      outputSchema: createSiteConfigSectionOutputSchema(),
      destructive: false,
      idempotent: false,
      handler: args => callSiteTool(client, 'update_site_social_buttons', args)
    }),
    defineTool({
      name: 'update_site_preferences',
      title: 'Update Site Preferences',
      description: 'Patch site preference fields without overwriting the entire site config.',
      inputSchema: sitePreferencesSchema,
      outputSchema: createSiteConfigSectionOutputSchema(),
      destructive: false,
      idempotent: false,
      handler: args => callSiteTool(client, 'update_site_preferences', args)
    }),
    defineTool({
      name: 'update_card_styles',
      title: 'Update Card Styles',
      description: 'Patch card styles by card key without replacing unrelated cards.',
      inputSchema: {
        type: 'object',
        properties: {
          cardStyles: cardStylesSchema
        },
        required: ['cardStyles'],
        additionalProperties: false
      },
      outputSchema: createSiteConfigSectionOutputSchema(),
      destructive: false,
      idempotent: false,
      handler: args => callSiteTool(client, 'update_card_styles', args)
    }),
    defineTool({
      name: 'get_about_page',
      title: 'Get About Page',
      description: 'Read the current about page document.',
      inputSchema: emptyInputSchema,
      outputSchema: createAboutOutputSchema(),
      readOnly: true,
      idempotent: true,
      handler: () => callSiteTool(client, 'get_about_page')
    }),
    defineTool({
      name: 'update_about_page',
      title: 'Update About Page',
      description: 'Patch the about page title, description, or content.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'string' }
        },
        additionalProperties: false
      },
      outputSchema: createAboutOutputSchema(),
      destructive: false,
      idempotent: false,
      handler: args => callSiteTool(client, 'update_about_page', args)
    })
  ]

  return createToolRegistry([...moduleTools, ...siteTools])
}
