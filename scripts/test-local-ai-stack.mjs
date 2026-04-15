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

const EXPECTED_BLOG_TOOLS = [
  'create_blog_draft',
  'publish_blog_post',
  'get_blog_post',
  'list_recent_posts',
  'search_blog_posts',
  'delete_blog_post'
]

const EXPECTED_CONTENT_TOOLS = [
  'list_projects',
  'get_project',
  'create_project',
  'update_project',
  'delete_project',
  'list_shares',
  'get_share',
  'create_share',
  'update_share',
  'delete_share',
  'list_bloggers',
  'get_blogger',
  'create_blogger',
  'update_blogger',
  'delete_blogger',
  'list_pictures',
  'get_picture',
  'create_picture',
  'update_picture',
  'delete_picture',
  'list_snippets',
  'get_snippet',
  'create_snippet',
  'update_snippet',
  'delete_snippet',
  'get_site_config',
  'update_site_meta',
  'update_site_theme',
  'update_site_images',
  'update_site_social_buttons',
  'update_site_preferences',
  'update_card_styles',
  'get_about_page',
  'update_about_page'
]

function createRunId() {
  const iso = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const random = Math.random().toString(36).slice(2, 8)
  return `${iso}-${random}`
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
  console.log(`[local-ai-stack] ${message}`)
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

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status} ${url}`)
  }

  return payload
}

async function waitForServer(baseUrl, serverLogs, timeoutMs = 90000) {
  const startedAt = Date.now()
  let lastError = 'server not ready yet'

  // `next start` can briefly return 500 on the first dynamic request right after reporting Ready.
  await delay(2000)

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const response = await fetch(`${baseUrl}${READY_PATH}`, { signal: controller.signal })
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

  const recentLogs = serverLogs.toArray()
  throw new Error(
    `Local Next server did not become ready at ${baseUrl}${READY_PATH}: ${lastError}${recentLogs.length ? `\n${recentLogs.join('\n')}` : ''}`
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
        name: 'local-ai-stack-test',
        version: '0.1.0'
      }
    })

    await this.notify('notifications/initialized')
    return initializeResult
  }

  async listTools() {
    const tools = []
    let cursor

    do {
      const result = await this.request('tools/list', cursor ? { cursor } : {})
      tools.push(...(Array.isArray(result?.tools) ? result.tools : []))
      cursor = result?.nextCursor
    } while (cursor)

    return tools
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
      } catch (error) {
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
        pending.reject(
          new Error(
            `${this.label} ${payload.error.message || 'request failed'}${payload.error.data ? `\n${JSON.stringify(payload.error.data, null, 2)}` : ''}`
          )
        )
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

async function withStep(report, name, fn) {
  const startedAt = Date.now()
  logStep(name)

  try {
    const details = await fn()
    report.checks.push({
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      details: details || null
    })
    return details
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report.checks.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: message
    })
    report.failures.push({ name, error: message })
    return null
  }
}

async function retryAssertion(assertion, timeoutMs = 3000, intervalMs = 200) {
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await assertion()
    } catch (error) {
      lastError = error
      await delay(intervalMs)
    }
  }

  if (lastError) {
    throw lastError
  }
}

function assertToolSet(tools, expected, label) {
  const actualNames = tools.map(tool => tool.name).sort()
  const expectedNames = [...expected].sort()
  assert.deepEqual(actualNames, expectedNames, `${label} tools mismatch.`)
}

function createModuleId(prefix, runId) {
  return `mcp-test-${prefix}-${runId.toLowerCase()}`
}

function buildSocialButtonsPayload(buttons = []) {
  return buttons.map((button, index) => ({
    id: button.id,
    type: button.type,
    value: button.value,
    label: button.label,
    order: Number.isFinite(button.order) ? button.order : index
  }))
}

function buildSitePreferencesPayload(siteContent) {
  return {
    backgroundColors: [...(siteContent.backgroundColors || [])],
    clockShowSeconds: Boolean(siteContent.clockShowSeconds),
    summaryInContent: Boolean(siteContent.summaryInContent),
    enableHat: Boolean(siteContent.enableHat),
    hatOffsetX: siteContent.hatOffsetX ?? null,
    hatOffsetY: siteContent.hatOffsetY ?? null,
    hatScale: siteContent.hatScale ?? null,
    isCachePem: Boolean(siteContent.isCachePem),
    hideEditButton: Boolean(siteContent.hideEditButton),
    enableCategories: Boolean(siteContent.enableCategories),
    currentHatIndex: Number.isFinite(siteContent.currentHatIndex) ? siteContent.currentHatIndex : 0,
    hatFlipped: Boolean(siteContent.hatFlipped),
    enableChristmas: Boolean(siteContent.enableChristmas),
    beian: {
      text: siteContent.beian?.text || '',
      link: siteContent.beian?.link || ''
    }
  }
}

async function testBlogPublisher(client, runId) {
  const token = runId.toLowerCase()
  let slug = null

  try {
    const recent = await client.callTool('list_recent_posts', {
      limit: 5,
      includeHidden: true
    })
    assert(Array.isArray(recent.posts), 'list_recent_posts must return posts.')

    const created = await client.callTool('create_blog_draft', {
      title: `MCP Local Test ${runId}`,
      summary: `Local MCP integration test ${runId}`,
      contentMd: `# MCP Local Test ${runId}\n\nThis is a temporary integration test post.`,
      tags: ['mcp-test', token],
      category: '测试',
      publish: false
    })
    slug = created?.post?.slug
    assert.equal(typeof slug, 'string', 'create_blog_draft must return a slug.')
    assert.equal(created?.post?.title, `MCP Local Test ${runId}`)

    const draft = await client.callTool('get_blog_post', {
      slug,
      includeHidden: true
    })
    assert.equal(draft?.post?.slug, slug, 'get_blog_post must load the created draft.')

    const searchDraft = await client.callTool('search_blog_posts', {
      query: runId,
      limit: 10,
      includeHidden: true
    })
    assert(searchDraft?.posts?.some(post => post.slug === slug), 'search_blog_posts should find the test draft.')

    const published = await client.callTool('publish_blog_post', { slug })
    assert.equal(published?.post?.slug, slug, 'publish_blog_post must return the same slug.')

    const publishedPost = await client.callTool('get_blog_post', {
      slug,
      includeHidden: false
    })
    assert.equal(publishedPost?.post?.slug, slug, 'Published post should be readable without includeHidden.')

    await client.callTool('delete_blog_post', { slug })

    let deletedError = null
    try {
      await client.callTool('get_blog_post', {
        slug,
        includeHidden: true
      })
    } catch (error) {
      deletedError = error
    }

    assert(deletedError instanceof Error, 'Deleted post should no longer be readable.')
    slug = null

    return {
      recentCount: recent.posts.length,
      createdSlug: created.post.slug
    }
  } finally {
    if (slug) {
      try {
        await client.callTool('delete_blog_post', { slug })
      } catch {
        // Best effort cleanup for temporary post data.
      }
    }
  }
}

async function testCrudModule(client, config) {
  const createdId = config.id
  let needsCleanup = false

  try {
    const initialList = await client.callTool(config.listTool, {
      query: config.query,
      limit: 10
    })
    assert(Array.isArray(initialList?.items), `${config.listTool} must return items.`)

    const created = await client.callTool(config.createTool, config.createInput)
    needsCleanup = true
    assert.equal(created?.item?.id, createdId, `${config.createTool} must preserve the test id.`)

    const loaded = await client.callTool(config.getTool, { id: createdId })
    assert.equal(loaded?.item?.id, createdId, `${config.getTool} must return the created item.`)

    const updated = await client.callTool(config.updateTool, {
      id: createdId,
      ...config.updateInput
    })
    assert.equal(updated?.item?.id, createdId, `${config.updateTool} must return the updated item.`)
    config.assertUpdated(updated?.item)

    const queried = await client.callTool(config.listTool, {
      query: config.query,
      limit: 10
    })
    assert(queried?.items?.some(item => item.id === createdId), `${config.listTool} query should include the test item.`)

    await client.callTool(config.deleteTool, { id: createdId })
    needsCleanup = false

    const afterDelete = await client.callTool(config.listTool, {
      query: config.query,
      limit: 10
    })
    assert(!afterDelete?.items?.some(item => item.id === createdId), `${config.deleteTool} should remove the test item.`)

    return {
      id: createdId,
      beforeCount: initialList.items.length,
      filteredCount: queried.items.length
    }
  } finally {
    if (needsCleanup) {
      try {
        await client.callTool(config.deleteTool, { id: createdId })
      } catch {
        // Best effort cleanup for temporary structured content.
      }
    }
  }
}

async function testSiteConfig(client, runId) {
  const original = await client.callTool('get_site_config', {})
  const siteContent = original.siteContent
  const originalCardStyles = original.cardStyles || {}
  const cardKeys = Object.keys(originalCardStyles)
  assert(cardKeys.length > 0, 'cardStyles must contain at least one card key for restore-safe testing.')
  const cardKey = cardKeys[0]
  const originalCardStyle = originalCardStyles[cardKey]

  const originalMeta = { ...siteContent.meta }
  const originalTheme = { ...siteContent.theme }
  const originalFaviconUrl = siteContent.faviconUrl
  const originalSocialButtons = buildSocialButtonsPayload(siteContent.socialButtons || [])
  const originalPreferences = buildSitePreferencesPayload(siteContent)

  const tempFavicon = `/favicon.png?mcp-test=${encodeURIComponent(runId)}`
  const tempSocialButtons = [
    ...originalSocialButtons,
    {
      id: `social-${runId.toLowerCase()}`,
      type: 'website',
      value: `https://example.com/${runId.toLowerCase()}`,
      label: `MCP ${runId}`,
      order: originalSocialButtons.length
    }
  ]
  const tempClockShowSeconds = !originalPreferences.clockShowSeconds
  const tempCardStyle = {
    ...originalCardStyle,
    width: Number(originalCardStyle.width || 0) + 1
  }

  try {
    await client.callTool('update_site_meta', {
      title: `${originalMeta.title} [${runId}]`
    })
    let current = await client.callTool('get_site_config', {})
    assert.equal(current?.siteContent?.meta?.title, `${originalMeta.title} [${runId}]`, 'Site meta title should update.')

    await client.callTool('update_site_theme', {
      colorBrand: '#123456'
    })
    current = await client.callTool('get_site_config', {})
    assert.equal(current?.siteContent?.theme?.colorBrand, '#123456', 'Site theme colorBrand should update.')

    await client.callTool('update_site_images', {
      faviconUrl: tempFavicon
    })
    current = await client.callTool('get_site_config', {})
    assert.equal(current?.siteContent?.faviconUrl, tempFavicon, 'Site images faviconUrl should update.')

    await client.callTool('update_site_social_buttons', {
      socialButtons: tempSocialButtons
    })
    current = await client.callTool('get_site_config', {})
    assert.equal(current?.siteContent?.socialButtons?.length, tempSocialButtons.length, 'Site social buttons should update.')

    await client.callTool('update_site_preferences', {
      clockShowSeconds: tempClockShowSeconds
    })
    current = await client.callTool('get_site_config', {})
    assert.equal(
      Boolean(current?.siteContent?.clockShowSeconds),
      tempClockShowSeconds,
      'Site preferences clockShowSeconds should update.'
    )

    await client.callTool('update_card_styles', {
      cardStyles: {
        [cardKey]: tempCardStyle
      }
    })
    current = await client.callTool('get_site_config', {})
    assert.equal(current?.cardStyles?.[cardKey]?.width, tempCardStyle.width, 'Card style width should update.')

    return {
      testedCardKey: cardKey,
      socialButtonCount: tempSocialButtons.length
    }
  } finally {
    const restoreErrors = []

    for (const restoreStep of [
      () =>
        client.callTool('update_card_styles', {
          cardStyles: {
            [cardKey]: originalCardStyle
          }
        }),
      () => client.callTool('update_site_preferences', originalPreferences),
      () =>
        client.callTool('update_site_social_buttons', {
          socialButtons: originalSocialButtons
        }),
      () => client.callTool('update_site_theme', originalTheme),
      () => client.callTool('update_site_meta', originalMeta),
      () =>
        client.callTool('update_site_images', {
          faviconUrl: originalFaviconUrl
        })
    ]) {
      try {
        await restoreStep()
      } catch (error) {
        restoreErrors.push(error instanceof Error ? error.message : String(error))
      }
    }

    await retryAssertion(async () => {
      const restored = await client.callTool('get_site_config', {})
      assert.equal(restored?.siteContent?.meta?.title, originalMeta.title, 'Site meta should restore.')
      assert.equal(restored?.siteContent?.theme?.colorBrand, originalTheme.colorBrand, 'Site theme should restore.')
      assert.equal(restored?.siteContent?.faviconUrl, originalFaviconUrl, 'Site images should restore.')
      assert.deepEqual(
        buildSocialButtonsPayload(restored?.siteContent?.socialButtons || []),
        originalSocialButtons,
        'Site social buttons should restore.'
      )
      assert.equal(
        Boolean(restored?.siteContent?.clockShowSeconds),
        originalPreferences.clockShowSeconds,
        'Site preferences should restore.'
      )
      assert.deepEqual(restored?.cardStyles?.[cardKey], originalCardStyle, 'Card styles should restore.')
    })

    if (restoreErrors.length > 0) {
      throw new Error(`Site config restore encountered errors:\n${restoreErrors.join('\n')}`)
    }
  }
}

async function testAboutPage(client, runId) {
  const original = await client.callTool('get_about_page', {})
  const about = original.about

  try {
    await client.callTool('update_about_page', {
      title: `${about.title} [${runId}]`,
      description: `${about.description} [${runId}]`,
      content: `${about.content}\n\n<!-- ${runId} -->`
    })

    const updated = await client.callTool('get_about_page', {})
    assert.equal(updated?.about?.title, `${about.title} [${runId}]`, 'About title should update.')
    assert(updated?.about?.content?.includes(`<!-- ${runId} -->`), 'About content should update.')

    return {
      originalTitle: about.title
    }
  } finally {
    await client.callTool('update_about_page', about)
    const restored = await client.callTool('get_about_page', {})
    assert.equal(restored?.about?.title, about.title, 'About title should restore.')
    assert.equal(restored?.about?.description, about.description, 'About description should restore.')
    assert.equal(restored?.about?.content, about.content, 'About content should restore.')
  }
}

async function main() {
  const runId = createRunId()
  const report = {
    runId,
    startedAt: new Date().toISOString(),
    baseUrl: null,
    checks: [],
    failures: []
  }

  await ensureBuildExists()

  const port = await findAvailablePort(2025)
  const baseUrl = `http://127.0.0.1:${port}`
  report.baseUrl = baseUrl

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

    await withStep(report, 'blog-publisher initialize + tools/list', async () => {
      const init = await blogClient.start()
      assert.equal(init?.protocolVersion, PROTOCOL_VERSION, 'blog-publisher protocol version mismatch.')
      const tools = await blogClient.listTools()
      assert.equal(tools.length, EXPECTED_BLOG_TOOLS.length, 'blog-publisher tool count mismatch.')
      assertToolSet(tools, EXPECTED_BLOG_TOOLS, 'blog-publisher')
      return {
        toolCount: tools.length
      }
    })

    await withStep(report, 'content-admin initialize + tools/list', async () => {
      const init = await contentClient.start()
      assert.equal(init?.protocolVersion, PROTOCOL_VERSION, 'content-admin protocol version mismatch.')
      const tools = await contentClient.listTools()
      assert.equal(tools.length, EXPECTED_CONTENT_TOOLS.length, 'content-admin tool count mismatch.')
      assertToolSet(tools, EXPECTED_CONTENT_TOOLS, 'content-admin')
      return {
        toolCount: tools.length
      }
    })

    await withStep(report, 'blog-publisher article CRUD flow', async () => testBlogPublisher(blogClient, runId))

    await withStep(report, 'content-admin projects CRUD flow', async () =>
      testCrudModule(contentClient, {
        id: createModuleId('project', runId),
        query: runId.toLowerCase(),
        listTool: 'list_projects',
        getTool: 'get_project',
        createTool: 'create_project',
        updateTool: 'update_project',
        deleteTool: 'delete_project',
        createInput: {
          id: createModuleId('project', runId),
          name: `MCP Test Project ${runId}`,
          year: 2026,
          image: '/images/avatar.png',
          url: `https://example.com/projects/${runId.toLowerCase()}`,
          description: `Temporary MCP project test ${runId}`,
          tags: ['mcp-test', runId.toLowerCase()],
          github: `https://github.com/example/${runId.toLowerCase()}`
        },
        updateInput: {
          description: `Updated MCP project test ${runId}`,
          tags: ['mcp-test', 'updated', runId.toLowerCase()]
        },
        assertUpdated(item) {
          assert.equal(item?.description, `Updated MCP project test ${runId}`)
          assert(item?.tags?.includes('updated'), 'Project tags should update.')
        }
      })
    )

    await withStep(report, 'content-admin shares CRUD flow', async () =>
      testCrudModule(contentClient, {
        id: createModuleId('share', runId),
        query: runId.toLowerCase(),
        listTool: 'list_shares',
        getTool: 'get_share',
        createTool: 'create_share',
        updateTool: 'update_share',
        deleteTool: 'delete_share',
        createInput: {
          id: createModuleId('share', runId),
          name: `MCP Test Share ${runId}`,
          logo: '/favicon.png',
          url: `https://example.com/shares/${runId.toLowerCase()}`,
          description: `Temporary MCP share test ${runId}`,
          tags: ['mcp-test', runId.toLowerCase()],
          stars: 4
        },
        updateInput: {
          description: `Updated MCP share test ${runId}`,
          stars: 5
        },
        assertUpdated(item) {
          assert.equal(item?.description, `Updated MCP share test ${runId}`)
          assert.equal(item?.stars, 5)
        }
      })
    )

    await withStep(report, 'content-admin bloggers CRUD flow', async () =>
      testCrudModule(contentClient, {
        id: createModuleId('blogger', runId),
        query: runId.toLowerCase(),
        listTool: 'list_bloggers',
        getTool: 'get_blogger',
        createTool: 'create_blogger',
        updateTool: 'update_blogger',
        deleteTool: 'delete_blogger',
        createInput: {
          id: createModuleId('blogger', runId),
          name: `MCP Test Blogger ${runId}`,
          avatar: '/images/avatar.png',
          url: `https://example.com/bloggers/${runId.toLowerCase()}`,
          description: `Temporary MCP blogger test ${runId}`,
          stars: 4,
          status: 'recent'
        },
        updateInput: {
          description: `Updated MCP blogger test ${runId}`,
          status: 'disconnected'
        },
        assertUpdated(item) {
          assert.equal(item?.description, `Updated MCP blogger test ${runId}`)
          assert.equal(item?.status, 'disconnected')
        }
      })
    )

    await withStep(report, 'content-admin pictures CRUD flow', async () =>
      testCrudModule(contentClient, {
        id: createModuleId('picture', runId),
        query: runId.toLowerCase(),
        listTool: 'list_pictures',
        getTool: 'get_picture',
        createTool: 'create_picture',
        updateTool: 'update_picture',
        deleteTool: 'delete_picture',
        createInput: {
          id: createModuleId('picture', runId),
          images: ['/images/avatar.png', '/favicon.png'],
          description: `Temporary MCP picture test ${runId}`,
          uploadedAt: new Date().toISOString()
        },
        updateInput: {
          description: `Updated MCP picture test ${runId}`
        },
        assertUpdated(item) {
          assert.equal(item?.description, `Updated MCP picture test ${runId}`)
          assert(Array.isArray(item?.images) && item.images.length === 2, 'Picture images should be preserved.')
        }
      })
    )

    await withStep(report, 'content-admin snippets CRUD flow', async () =>
      testCrudModule(contentClient, {
        id: createModuleId('snippet', runId),
        query: runId.toLowerCase(),
        listTool: 'list_snippets',
        getTool: 'get_snippet',
        createTool: 'create_snippet',
        updateTool: 'update_snippet',
        deleteTool: 'delete_snippet',
        createInput: {
          id: createModuleId('snippet', runId),
          content: `Temporary MCP snippet test ${runId}`
        },
        updateInput: {
          content: `Updated MCP snippet test ${runId}`
        },
        assertUpdated(item) {
          assert.equal(item?.content, `Updated MCP snippet test ${runId}`)
        }
      })
    )

    await withStep(report, 'content-admin site-config section patch + restore flow', async () =>
      testSiteConfig(contentClient, runId)
    )

    await withStep(report, 'content-admin about page patch + restore flow', async () =>
      testAboutPage(contentClient, runId)
    )
  } finally {
    await Promise.allSettled([blogClient.close(), contentClient.close()])

    if (nextServer.exitCode === null && !nextServer.killed) {
      nextServer.kill()
      await Promise.race([once(nextServer, 'exit').catch(() => null), delay(5000)])
    }
  }

  report.completedAt = new Date().toISOString()
  report.passed = report.failures.length === 0

  console.log(JSON.stringify(report, null, 2))

  if (!report.passed) {
    process.exitCode = 1
  }
}

await main()
