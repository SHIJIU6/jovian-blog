import { createAdminApiClient } from './mcp-runtime.mjs'
import { createEnvelopeSchema, createSummarySchema, createToolRegistry, defineTool } from './mcp-tooling.mjs'

export const BLOG_MCP_SERVER_INFO = {
  name: '2025-blog-publisher',
  title: '2025 Blog Publisher',
  version: '0.4.0'
}

export const BLOG_MCP_SERVER_INSTRUCTIONS =
  'Use this server only to author or publish blog posts for the 2025-blog-public repository. Prefer draft-first writes, verify every mutation with a read tool, and do not delete posts unless the user explicitly asked for deletion.'

const postSchema = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string' },
    category: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string' }
    },
    coverUrl: { type: 'string' },
    date: { type: 'string' },
    status: { type: 'string' },
    hidden: { type: 'boolean' },
    contentMd: { type: 'string' }
  },
  additionalProperties: true
}

function createPostEnvelopeSchema() {
  return createEnvelopeSchema(
    {
      post: postSchema,
      summary: createSummarySchema({
        action: { type: 'string' },
        slug: { type: 'string' },
        status: { type: 'string' }
      })
    },
    ['post', 'summary']
  )
}

function createPostListSchema() {
  return createEnvelopeSchema(
    {
      posts: {
        type: 'array',
        items: postSchema
      },
      summary: createSummarySchema({
        total: { type: 'number' },
        limit: { type: 'number' },
        query: { type: 'string' },
        includeHidden: { type: 'boolean' }
      })
    },
    ['posts', 'summary']
  )
}

function createDeleteSchema() {
  return createEnvelopeSchema(
    {
      slug: { type: 'string' },
      result: {
        type: 'object',
        additionalProperties: true
      },
      summary: createSummarySchema({
        action: { type: 'string' },
        slug: { type: 'string' }
      })
    },
    ['slug', 'result', 'summary']
  )
}

const createDraftInputSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Optional explicit blog title.' },
    topic: { type: 'string', description: 'Optional topic or idea label.' },
    summary: { type: 'string', description: 'Optional summary.' },
    contentMd: { type: 'string', description: 'Optional final Markdown content.' },
    discussion: { type: 'string', description: 'Optional discussion transcript or organized notes.' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional tags.'
    },
    category: { type: 'string', description: 'Optional category.' },
    coverUrl: { type: 'string', description: 'Optional cover URL.' },
    date: { type: 'string', description: 'Optional ISO date.' },
    publish: { type: 'boolean', description: 'Whether to publish immediately. Defaults to false.' },
    status: {
      type: 'string',
      description: 'Optional explicit status: draft, published, or offline.'
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          note: { type: 'string' }
        },
        required: ['title', 'url'],
        additionalProperties: false
      },
      description: 'Optional source list.'
    }
  },
  additionalProperties: false
}

const slugSchema = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'Blog post slug.' }
  },
  required: ['slug'],
  additionalProperties: false
}

const getPostSchema = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'Post slug.' },
    includeHidden: { type: 'boolean', description: 'Whether to include hidden drafts.' }
  },
  required: ['slug'],
  additionalProperties: false
}

const listPostsSchema = {
  type: 'object',
  properties: {
    limit: { type: 'number', description: 'Optional limit, default 10.' },
    includeHidden: { type: 'boolean', description: 'Whether to include hidden drafts.' }
  },
  additionalProperties: false
}

const searchPostsSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search keyword.' },
    limit: { type: 'number', description: 'Optional limit, default 10.' },
    includeHidden: { type: 'boolean', description: 'Whether to include hidden drafts.' }
  },
  required: ['query'],
  additionalProperties: false
}

export function createBlogMcpToolRegistry(client = createAdminApiClient()) {
  return createToolRegistry([
    defineTool({
      name: 'create_blog_draft',
      title: 'Create Blog Draft',
      description: 'Create a draft or directly published blog post from title, topic, or discussion content.',
      inputSchema: createDraftInputSchema,
      outputSchema: createPostEnvelopeSchema(),
      destructive: false,
      idempotent: false,
      handler: async args => {
        const payload = await client.requestJson('/api/admin/posts/create-draft', {
          method: 'POST',
          body: JSON.stringify({
            ...args,
            publish: Boolean(args.publish)
          })
        })
        const status = payload.post?.status || (payload.post?.hidden ? 'draft' : 'published')
        return {
          summary: `Post "${payload.post.title}" created with slug "${payload.post.slug}" (${status}).`,
          data: {
            post: payload.post,
            summary: {
              action: 'create',
              slug: payload.post?.slug,
              status
            }
          }
        }
      }
    }),
    defineTool({
      name: 'publish_blog_post',
      title: 'Publish Blog Post',
      description: 'Publish an existing draft blog post by slug.',
      inputSchema: slugSchema,
      outputSchema: createPostEnvelopeSchema(),
      destructive: false,
      idempotent: false,
      handler: async args => {
        const payload = await client.requestJson('/api/admin/posts/publish-draft', {
          method: 'POST',
          body: JSON.stringify({
            slug: args.slug
          })
        })
        return {
          summary: `Post "${payload.post.title}" is now published.`,
          data: {
            post: payload.post,
            summary: {
              action: 'publish',
              slug: payload.post?.slug,
              status: payload.post?.status || 'published'
            }
          }
        }
      }
    }),
    defineTool({
      name: 'get_blog_post',
      title: 'Get Blog Post',
      description: 'Read a single blog post, including hidden drafts when requested.',
      inputSchema: getPostSchema,
      outputSchema: createPostEnvelopeSchema(),
      readOnly: true,
      idempotent: true,
      handler: async args => {
        const includeHidden = args.includeHidden !== false
        const payload = await client.requestJson(
          `/api/content/posts/${encodeURIComponent(args.slug)}?includeHidden=${includeHidden ? 'true' : 'false'}`
        )
        return {
          summary: `Loaded post "${payload.title}" (${payload.slug}).`,
          data: {
            post: payload,
            summary: {
              action: 'get',
              slug: payload.slug,
              status: payload.status || (payload.hidden ? 'draft' : 'published')
            }
          }
        }
      }
    }),
    defineTool({
      name: 'list_recent_posts',
      title: 'List Recent Posts',
      description: 'List recent blog posts from the project content API.',
      inputSchema: listPostsSchema,
      outputSchema: createPostListSchema(),
      readOnly: true,
      idempotent: true,
      handler: async args => {
        const limit = Number.isFinite(args.limit) ? args.limit : 10
        const includeHidden = args.includeHidden !== false
        const payload = await client.requestJson(
          `/api/content/posts?includeHidden=${includeHidden ? 'true' : 'false'}&limit=${limit}`
        )
        const posts = Array.isArray(payload) ? payload : []
        return {
          summary: `Loaded ${posts.length} posts.`,
          data: {
            posts,
            summary: {
              total: posts.length,
              limit,
              includeHidden
            }
          }
        }
      }
    }),
    defineTool({
      name: 'search_blog_posts',
      title: 'Search Blog Posts',
      description: 'Search current blog posts by title, slug, category, or tags and return matching posts.',
      inputSchema: searchPostsSchema,
      outputSchema: createPostListSchema(),
      readOnly: true,
      idempotent: true,
      handler: async args => {
        const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
        const limit = Number.isFinite(args.limit) ? args.limit : 10
        const includeHidden = args.includeHidden !== false
        const payload = await client.requestJson(
          `/api/content/posts?includeHidden=${includeHidden ? 'true' : 'false'}&limit=100`
        )
        const list = Array.isArray(payload) ? payload : []
        const posts = list
          .filter(post => {
            const title = String(post.title || '').toLowerCase()
            const slug = String(post.slug || '').toLowerCase()
            const category = String(post.category || '').toLowerCase()
            const tags = Array.isArray(post.tags)
              ? post.tags.map(tag => String(tag).toLowerCase())
              : []
            return (
              title.includes(query) ||
              slug.includes(query) ||
              category.includes(query) ||
              tags.some(tag => tag.includes(query))
            )
          })
          .slice(0, limit)
        return {
          summary: `Found ${posts.length} matching posts for "${args.query}".`,
          data: {
            posts,
            summary: {
              total: posts.length,
              limit,
              query: args.query,
              includeHidden
            }
          }
        }
      }
    }),
    defineTool({
      name: 'delete_blog_post',
      title: 'Delete Blog Post',
      description: 'Delete a blog post by slug. Only call this after explicit user confirmation.',
      inputSchema: slugSchema,
      outputSchema: createDeleteSchema(),
      destructive: true,
      idempotent: false,
      handler: async args => {
        const slug = typeof args.slug === 'string' ? args.slug : ''
        const payload = await client.requestJson(`/api/admin/posts/${encodeURIComponent(slug)}`, {
          method: 'DELETE'
        })
        return {
          summary: `Post "${slug}" deleted.`,
          data: {
            slug,
            result: payload || {},
            summary: {
              action: 'delete',
              slug
            }
          }
        }
      }
    })
  ])
}
