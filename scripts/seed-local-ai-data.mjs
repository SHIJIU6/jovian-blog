import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { stat } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const ROOT = process.cwd()
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const BLOG_MCP_ENTRY = path.join(ROOT, 'scripts', 'blog-mcp-server.mjs')
const CONTENT_MCP_ENTRY = path.join(ROOT, 'scripts', 'content-mcp-server.mjs')
const PROTOCOL_VERSION = '2025-11-25'
const READY_PATH = '/api/content/posts?limit=1'

function createRunId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const random = Math.random().toString(36).slice(2, 8)
  return `${timestamp}-${random}`
}

function createLineBuffer(limit = 40) {
  const lines = []

  return {
    push(chunk) {
      const text = String(chunk || '')
        .split(/\r?\n/u)
        .map(line => line.trim())
        .filter(Boolean)
      for (const line of text) {
        lines.push(line)
        if (lines.length > limit) lines.shift()
      }
    },
    toArray() {
      return [...lines]
    }
  }
}

function logStep(message) {
  console.log(`[seed-local-ai-data] ${message}`)
}

async function ensureBuildExists() {
  await stat(path.join(ROOT, '.next', 'BUILD_ID'))
}

async function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

async function findAvailablePort(start = 2025, attempts = 25) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = start + offset
    if (await isPortAvailable(port)) {
      return port
    }
  }

  throw new Error(`Unable to find an open local port near ${start}.`)
}

async function waitForServer(baseUrl, serverLogs, timeoutMs = 90000) {
  const startedAt = Date.now()
  let lastError = 'server not ready yet'

  await delay(2000)

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const response = await fetch(`${baseUrl}${READY_PATH}`, {
        signal: controller.signal
      })
      clearTimeout(timer)

      if (response.ok) {
        return
      }

      const body = await response.text().catch(() => '')
      lastError = `HTTP ${response.status}${body ? ` ${body.slice(0, 300)}` : ''}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    await delay(1000)
  }

  throw new Error(
    `Local Next server did not become ready at ${baseUrl}${READY_PATH}: ${lastError}${serverLogs.toArray().length ? `\n${serverLogs.toArray().join('\n')}` : ''}`
  )
}

function normalizeResultText(content = []) {
  return content
    .map(item => (item && typeof item.text === 'string' ? item.text.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

class McpClient {
  constructor(label, entryFile, env) {
    this.label = label
    this.entryFile = entryFile
    this.env = env
    this.child = null
    this.buffer = ''
    this.requestId = 1
    this.pending = new Map()
    this.stderr = createLineBuffer()
  }

  async start() {
    this.child = spawn(process.execPath, [this.entryFile], {
      cwd: ROOT,
      env: {
        ...process.env,
        ...this.env
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.child.stdout.setEncoding('utf8')
    this.child.stderr.setEncoding('utf8')
    this.child.stdout.on('data', chunk => this.#handleStdout(chunk))
    this.child.stderr.on('data', chunk => this.stderr.push(chunk))

    this.child.on('error', error => {
      this.#rejectPending(new Error(`${this.label} failed to start: ${error.message}`))
    })

    this.child.on('exit', (code, signal) => {
      const detail = `${this.label} exited${code !== null ? ` with code ${code}` : ''}${signal ? ` via ${signal}` : ''}`
      this.#rejectPending(new Error(`${detail}${this.stderr.toArray().length ? `\n${this.stderr.toArray().join('\n')}` : ''}`))
    })

    const initializeResult = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'seed-local-ai-data',
        version: '0.1.0'
      }
    })

    await this.notify('notifications/initialized')
    return initializeResult
  }

  async callTool(name, args = {}) {
    const result = await this.request('tools/call', {
      name,
      arguments: args
    })

    if (result?.isError) {
      throw new Error(normalizeResultText(result.content) || `${this.label}:${name} failed.`)
    }

    return result?.structuredContent
  }

  async request(method, params) {
    const id = this.requestId
    this.requestId += 1

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.#send({
        jsonrpc: '2.0',
        id,
        method,
        ...(params !== undefined ? { params } : {})
      })
    })
  }

  async notify(method, params) {
    this.#send({
      jsonrpc: '2.0',
      method,
      ...(params !== undefined ? { params } : {})
    })
  }

  async close() {
    if (!this.child) return

    const child = this.child
    this.child = null

    if (!child.killed && child.stdin.writable) {
      child.stdin.end()
    }

    const exitPromise = once(child, 'exit').catch(() => null)
    await Promise.race([exitPromise, delay(3000)])

    if (child.exitCode === null && !child.killed) {
      child.kill()
      await Promise.race([once(child, 'exit').catch(() => null), delay(2000)])
    }
  }

  #send(message) {
    if (!this.child || !this.child.stdin.writable) {
      throw new Error(`${this.label} stdin is not writable.`)
    }

    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  #handleStdout(chunk) {
    this.buffer += chunk

    while (true) {
      const newlineIndex = this.buffer.indexOf('\n')
      if (newlineIndex === -1) break

      const line = this.buffer.slice(0, newlineIndex).replace(/\r$/u, '')
      this.buffer = this.buffer.slice(newlineIndex + 1)

      if (!line.trim()) continue

      let payload = null
      try {
        payload = JSON.parse(line)
      } catch {
        this.#rejectPending(new Error(`${this.label} returned invalid JSON: ${line}`))
        return
      }

      if (payload?.id === undefined) {
        continue
      }

      const pending = this.pending.get(payload.id)
      if (!pending) continue
      this.pending.delete(payload.id)

      if (payload.error) {
        pending.reject(new Error(`${this.label} ${payload.error.message || 'request failed'}`))
        continue
      }

      pending.resolve(payload.result)
    }
  }

  #rejectPending(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error)
    }
    this.pending.clear()
  }
}

async function main() {
  const runId = createRunId()
  const runKey = runId.toLowerCase()

  await ensureBuildExists()

  const port = await findAvailablePort(2025)
  const baseUrl = `http://127.0.0.1:${port}`
  const serverLogs = createLineBuffer()
  const nextServer = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port), '--hostname', '127.0.0.1'], {
    cwd: ROOT,
    env: {
      ...process.env,
      BLOG_LOCAL_ADMIN_BYPASS: 'true',
      PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  nextServer.stdout.setEncoding('utf8')
  nextServer.stderr.setEncoding('utf8')
  nextServer.stdout.on('data', chunk => serverLogs.push(chunk))
  nextServer.stderr.on('data', chunk => serverLogs.push(chunk))

  const sharedEnv = {
    BLOG_BASE_URL: baseUrl,
    BLOG_LOCAL_ADMIN_BYPASS: 'true'
  }
  const blogClient = new McpClient('blog-publisher', BLOG_MCP_ENTRY, sharedEnv)
  const contentClient = new McpClient('content-admin', CONTENT_MCP_ENTRY, sharedEnv)

  try {
    await waitForServer(baseUrl, serverLogs)
    await blogClient.start()
    await contentClient.start()

    logStep('创建并发布文章')
    const beforePosts = await blogClient.callTool('list_recent_posts', {
      limit: 10,
      includeHidden: true
    })
    const draft = await blogClient.callTool('create_blog_draft', {
      title: `本地 MCP 示例文章 ${runId}`,
      summary: `使用本地 skill 约束与 MCP 为项目内容模块播种示例数据。`,
      contentMd: `# 本地 MCP 示例文章 ${runId}\n\n这是一篇通过本地 blog-publisher MCP 创建的示例文章。\n\n- 创建时间：${new Date().toISOString()}\n- 标识：${runId}\n- 说明：用于本地内容模块联调演示。`,
      tags: ['mcp', 'skill', '本地示例'],
      category: '测试',
      publish: false
    })
    assert.equal(typeof draft?.post?.slug, 'string', '文章草稿未返回 slug。')
    await blogClient.callTool('get_blog_post', {
      slug: draft.post.slug,
      includeHidden: true
    })
    const published = await blogClient.callTool('publish_blog_post', {
      slug: draft.post.slug
    })
    const verifiedPost = await blogClient.callTool('get_blog_post', {
      slug: draft.post.slug,
      includeHidden: false
    })
    assert.equal(verifiedPost?.post?.slug, draft.post.slug, '文章发布后校验失败。')

    const projectId = `local-seed-project-${runKey}`
    logStep('创建项目数据')
    await contentClient.callTool('list_projects', { query: runKey, limit: 5 })
    await contentClient.callTool('create_project', {
      id: projectId,
      name: `本地 MCP 项目示例 ${runId}`,
      year: 2026,
      image: '/images/blockies.svg',
      url: `https://example.com/projects/${runKey}`,
      description: `通过本地 content-admin MCP 创建的项目示例 ${runId}`,
      tags: ['mcp', 'local', 'demo'],
      github: `https://github.com/example/${runKey}`
    })
    const verifiedProject = await contentClient.callTool('get_project', { id: projectId })
    assert.equal(verifiedProject?.item?.id, projectId, '项目写入校验失败。')

    const shareId = `local-seed-share-${runKey}`
    logStep('创建资源数据')
    await contentClient.callTool('list_shares', { query: runKey, limit: 5 })
    await contentClient.callTool('create_share', {
      id: shareId,
      name: `本地 MCP 资源示例 ${runId}`,
      logo: '/favicon.png',
      url: `https://example.com/shares/${runKey}`,
      description: `通过本地 content-admin MCP 创建的资源示例 ${runId}`,
      tags: ['mcp', 'local', 'demo'],
      stars: 4
    })
    const verifiedShare = await contentClient.callTool('get_share', { id: shareId })
    assert.equal(verifiedShare?.item?.id, shareId, '资源写入校验失败。')

    const bloggerId = `local-seed-blogger-${runKey}`
    logStep('创建博主数据')
    await contentClient.callTool('list_bloggers', { query: runKey, limit: 5 })
    await contentClient.callTool('create_blogger', {
      id: bloggerId,
      name: `本地 MCP 博主示例 ${runId}`,
      avatar: '/images/blockies.svg',
      url: `https://example.com/bloggers/${runKey}`,
      description: `通过本地 content-admin MCP 创建的博主示例 ${runId}`,
      stars: 4,
      status: 'recent'
    })
    const verifiedBlogger = await contentClient.callTool('get_blogger', { id: bloggerId })
    assert.equal(verifiedBlogger?.item?.id, bloggerId, '博主写入校验失败。')

    const pictureId = `local-seed-picture-${runKey}`
    logStep('创建图片数据')
    await contentClient.callTool('list_pictures', { query: runKey, limit: 5 })
    await contentClient.callTool('create_picture', {
      id: pictureId,
      images: ['/images/blockies.svg', '/favicon.png'],
      description: `通过本地 content-admin MCP 创建的图片组示例 ${runId}`,
      uploadedAt: new Date().toISOString()
    })
    const verifiedPicture = await contentClient.callTool('get_picture', { id: pictureId })
    assert.equal(verifiedPicture?.item?.id, pictureId, '图片写入校验失败。')

    const snippetId = `local-seed-snippet-${runKey}`
    logStep('创建短句数据')
    await contentClient.callTool('list_snippets', { query: runKey, limit: 5 })
    await contentClient.callTool('create_snippet', {
      id: snippetId,
      content: `本地 MCP 短句示例 ${runId}`
    })
    const verifiedSnippet = await contentClient.callTool('get_snippet', { id: snippetId })
    assert.equal(verifiedSnippet?.item?.id, snippetId, '短句写入校验失败。')

    const result = {
      baseUrl,
      post: {
        beforeCount: Array.isArray(beforePosts?.posts) ? beforePosts.posts.length : null,
        slug: draft.post.slug,
        status: published?.post?.status || 'published'
      },
      project: {
        id: projectId,
        name: verifiedProject.item.name
      },
      share: {
        id: shareId,
        name: verifiedShare.item.name
      },
      blogger: {
        id: bloggerId,
        name: verifiedBlogger.item.name
      },
      picture: {
        id: pictureId,
        imageCount: Array.isArray(verifiedPicture.item.images) ? verifiedPicture.item.images.length : 0
      },
      snippet: {
        id: snippetId,
        content: verifiedSnippet.item.content
      }
    }

    console.log(JSON.stringify(result, null, 2))
  } finally {
    await Promise.allSettled([blogClient.close(), contentClient.close()])

    if (nextServer.exitCode === null && !nextServer.killed) {
      nextServer.kill()
      await Promise.race([once(nextServer, 'exit').catch(() => null), delay(5000)])
    }
  }
}

await main()
