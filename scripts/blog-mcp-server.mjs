#!/usr/bin/env node

/**
 * Reference: Model Context Protocol stdio transport and lifecycle docs
 * (protocol revision 2025-11-25, checked on 2026-04-09).
 * This local server intentionally focuses on blog authoring tools so Codex / Claude Code
 * can turn an in-chat discussion into a draft or published post by calling the project's own APIs.
 */

const PROTOCOL_VERSION = '2025-11-25'
const SERVER_INFO = {
  name: '2025-blog-publisher',
  version: '0.1.0'
}

const BLOG_BASE_URL = process.env.BLOG_BASE_URL || 'http://127.0.0.1:2025'
const ADMIN_EMAIL = process.env.BLOG_ADMIN_EMAIL || ''
const ADMIN_TOKEN = process.env.BLOG_ADMIN_TOKEN || ''
let toolCallQueue = Promise.resolve()

const TOOLS = [
  {
    name: 'create_blog_draft',
    title: 'Create Blog Draft',
    description: 'Create a draft or directly published blog post from title/topic/discussion content.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Optional explicit blog title.' },
        topic: { type: 'string', description: 'Optional topic or idea label.' },
        summary: { type: 'string', description: 'Optional summary.' },
        contentMd: { type: 'string', description: 'Optional final Markdown content.' },
        discussion: { type: 'string', description: 'Optional discussion transcript or整理内容.' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags.'
        },
        category: { type: 'string', description: 'Optional category.' },
        coverUrl: { type: 'string', description: 'Optional cover URL.' },
        date: { type: 'string', description: 'Optional ISO date.' },
        publish: { type: 'boolean', description: 'Whether to publish immediately. Defaults to false.' },
        status: { type: 'string', description: 'Optional explicit status: draft, published, or offline.' },
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
  },
  {
    name: 'publish_blog_post',
    title: 'Publish Blog Post',
    description: 'Publish an existing draft blog post by slug.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Draft slug to publish.' }
      },
      required: ['slug'],
      additionalProperties: false
    }
  },
  {
    name: 'get_blog_post',
    title: 'Get Blog Post',
    description: 'Read a single blog post, including hidden drafts when running locally.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Post slug.' },
        includeHidden: { type: 'boolean', description: 'Whether to include hidden drafts.' }
      },
      required: ['slug'],
      additionalProperties: false
    }
  },
  {
    name: 'list_recent_posts',
    title: 'List Recent Posts',
    description: 'List recent blog posts from the project content API.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Optional limit, default 10.' },
        includeHidden: { type: 'boolean', description: 'Whether to include hidden drafts.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'search_blog_posts',
    title: 'Search Blog Posts',
    description: 'Search current blog posts by title, slug, category, or tags and return matching posts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword.' },
        limit: { type: 'number', description: 'Optional limit, default 10.' },
        includeHidden: { type: 'boolean', description: 'Whether to include hidden drafts.' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_blog_post',
    title: 'Delete Blog Post',
    description: 'Delete a blog post by slug.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Post slug to delete.' }
      },
      required: ['slug'],
      additionalProperties: false
    }
  }
]

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (ADMIN_EMAIL) {
    headers['x-admin-email'] = ADMIN_EMAIL
  }

  if (ADMIN_TOKEN) {
    headers.authorization = `Bearer ${ADMIN_TOKEN}`
  }

  return headers
}

async function requestJson(pathname, init = {}) {
  const url = `${BLOG_BASE_URL.replace(/\/$/, '')}${pathname}`
  const response = await fetch(url, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init.headers || {})
    }
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error((payload && payload.error) || `Request failed: ${response.status} ${pathname}`)
  }

  return payload
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'create_blog_draft': {
      const payload = await requestJson('/api/admin/posts/create-draft', {
        method: 'POST',
        body: JSON.stringify({
          ...args,
          publish: Boolean(args.publish)
        })
      })
      const status = payload.post?.status || (payload.post?.hidden ? 'draft' : 'published')
      return {
        summary: `Post "${payload.post.title}" created with slug "${payload.post.slug}" (${status}).`,
        data: payload
      }
    }

    case 'publish_blog_post': {
      const payload = await requestJson('/api/admin/posts/publish-draft', {
        method: 'POST',
        body: JSON.stringify({
          slug: args.slug
        })
      })
      return {
        summary: `Post "${payload.post.title}" is now published.`,
        data: payload
      }
    }

    case 'get_blog_post': {
      const includeHidden = args.includeHidden !== false
      const payload = await requestJson(`/api/content/posts/${encodeURIComponent(args.slug)}?includeHidden=${includeHidden ? 'true' : 'false'}`)
      return {
        summary: `Loaded post "${payload.title}" (${payload.slug}).`,
        data: payload
      }
    }

    case 'list_recent_posts': {
      const limit = Number.isFinite(args.limit) ? args.limit : 10
      const includeHidden = args.includeHidden !== false
      const payload = await requestJson(`/api/content/posts?includeHidden=${includeHidden ? 'true' : 'false'}&limit=${limit}`)
      return {
        summary: `Loaded ${Array.isArray(payload) ? payload.length : 0} posts.`,
        data: payload
      }
    }

    case 'search_blog_posts': {
      const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
      const limit = Number.isFinite(args.limit) ? args.limit : 10
      const includeHidden = args.includeHidden !== false
      const payload = await requestJson(`/api/content/posts?includeHidden=${includeHidden ? 'true' : 'false'}&limit=100`)
      const list = Array.isArray(payload) ? payload : []
      const matches = list.filter(post => {
        const title = String(post.title || '').toLowerCase()
        const slug = String(post.slug || '').toLowerCase()
        const category = String(post.category || '').toLowerCase()
        const tags = Array.isArray(post.tags) ? post.tags.map(tag => String(tag).toLowerCase()) : []
        return title.includes(query) || slug.includes(query) || category.includes(query) || tags.some(tag => tag.includes(query))
      }).slice(0, limit)

      return {
        summary: `Found ${matches.length} matching posts for "${args.query}".`,
        data: matches
      }
    }

    case 'delete_blog_post': {
      const slug = typeof args.slug === 'string' ? args.slug : ''
      const payload = await requestJson(`/api/admin/posts/${encodeURIComponent(slug)}`, {
        method: 'DELETE'
      })
      return {
        summary: `Post "${slug}" deleted.`,
        data: payload
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

function send(message) {
  const json = JSON.stringify(message)
  const content = Buffer.from(json, 'utf8')
  process.stdout.write(`Content-Length: ${content.length}\r\n\r\n`)
  process.stdout.write(content)
}

function sendResult(id, result) {
  send({
    jsonrpc: '2.0',
    id,
    result
  })
}

function sendError(id, code, message) {
  send({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  })
}

async function handleRequest(request) {
  const { id, method, params } = request

  if (method === 'initialize') {
    return sendResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: {}
      },
      serverInfo: SERVER_INFO
    })
  }

  if (method === 'ping') {
    return sendResult(id, {})
  }

  if (method === 'tools/list') {
    return sendResult(id, {
      tools: TOOLS
    })
  }

  if (method === 'tools/call') {
    return toolCallQueue = toolCallQueue.then(async () => {
      try {
        const result = await callTool(params?.name, params?.arguments || {})
        return sendResult(id, {
          content: [
            {
              type: 'text',
              text: result.summary
            }
          ],
          structuredContent: result.data
        })
      } catch (error) {
        return sendResult(id, {
          isError: true,
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown tool error'
            }
          ]
        })
      }
    })
  }

  if (method === 'notifications/initialized') {
    return
  }

  return sendError(id, -32601, `Method not found: ${method}`)
}

let buffer = Buffer.alloc(0)
let stdinEnded = false
let inFlight = 0

function maybeExit() {
  if (stdinEnded && inFlight === 0) {
    process.exit(0)
  }
}

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd === -1) return

    const headerText = buffer.slice(0, headerEnd).toString('utf8')
    const contentLengthMatch = headerText.match(/Content-Length:\s*(\d+)/i)
    if (!contentLengthMatch) {
      buffer = buffer.slice(headerEnd + 4)
      continue
    }

    const contentLength = Number(contentLengthMatch[1])
    const messageStart = headerEnd + 4
    const totalLength = messageStart + contentLength
    if (buffer.length < totalLength) return

    const rawMessage = buffer.slice(messageStart, totalLength).toString('utf8')
    buffer = buffer.slice(totalLength)

    let message
    try {
      message = JSON.parse(rawMessage)
    } catch (error) {
      sendError(null, -32700, 'Parse error')
      continue
    }

    inFlight += 1
    Promise.resolve(handleRequest(message))
      .catch(error => {
        if (message?.id !== undefined) {
          sendError(message.id, -32603, error instanceof Error ? error.message : 'Internal error')
        }
      })
      .finally(() => {
        inFlight -= 1
        maybeExit()
      })
  }
}

process.stdin.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk])
  processBuffer()
})

process.stdin.on('end', () => {
  stdinEnded = true
  maybeExit()
})
