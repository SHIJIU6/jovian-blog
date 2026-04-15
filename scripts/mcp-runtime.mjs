const PROTOCOL_VERSION = '2025-11-25'
const SUPPORTED_PROTOCOL_VERSIONS = [PROTOCOL_VERSION]
const JSON_RPC_VERSION = '2.0'
const JSON_RPC_PARSE_ERROR = -32700
const JSON_RPC_INVALID_REQUEST = -32600
const JSON_RPC_METHOD_NOT_FOUND = -32601
const JSON_RPC_INVALID_PARAMS = -32602
const JSON_RPC_INTERNAL_ERROR = -32603
const MCP_NOT_INITIALIZED = -32002

export function createAdminApiClient(env = process.env) {
  const baseUrl = env.BLOG_BASE_URL || 'http://127.0.0.1:2025'
  const adminEmail = env.BLOG_ADMIN_EMAIL || ''
  const adminToken = env.BLOG_ADMIN_TOKEN || ''
  const accessClientId = env.CF_ACCESS_CLIENT_ID || ''
  const accessClientSecret = env.CF_ACCESS_CLIENT_SECRET || ''

  function buildHeaders(extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    }

    if (accessClientId && accessClientSecret) {
      headers['CF-Access-Client-Id'] = accessClientId
      headers['CF-Access-Client-Secret'] = accessClientSecret
    }

    if (adminEmail) {
      headers['x-admin-email'] = adminEmail
    }

    if (adminToken) {
      headers.authorization = `Bearer ${adminToken}`
    }

    return headers
  }

  async function requestJson(pathname, init = {}) {
    const url = `${baseUrl.replace(/\/$/, '')}${pathname}`
    const response = await fetch(url, {
      ...init,
      headers: buildHeaders(init.headers || {})
    })

    const text = await response.text()
    let payload = null

    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        throw new Error(`Expected JSON response but received: ${text.slice(0, 180)}`)
      }
    }

    if (!response.ok) {
      throw new Error((payload && payload.error) || `Request failed: ${response.status} ${pathname}`)
    }

    return payload
  }

  return {
    buildHeaders,
    requestJson
  }
}

export class McpProtocolError extends Error {
  constructor(code, message, data) {
    super(message)
    this.name = 'McpProtocolError'
    this.code = code
    this.data = data
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function sendResult(id, result) {
  send({
    jsonrpc: JSON_RPC_VERSION,
    id,
    result
  })
}

function sendError(id, code, message, data) {
  const payload = {
    jsonrpc: JSON_RPC_VERSION,
    ...(id === undefined ? {} : { id }),
    error: {
      code,
      message
    }
  }

  if (data !== undefined) {
    payload.error.data = data
  }

  send(payload)
}

function serializeToolData(data) {
  if (data === undefined) return ''
  if (typeof data === 'string') return data

  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function buildToolResultPayload(result, name) {
  const summary = typeof result?.summary === 'string' ? result.summary : `Tool "${name}" completed.`
  const serialized = serializeToolData(result?.data)
  const text = serialized ? `${summary}\n\n${serialized}` : summary

  return {
    content: [
      {
        type: 'text',
        text
      }
    ],
    ...(result?.data !== undefined ? { structuredContent: result.data } : {})
  }
}

function ensureRequestShape(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new McpProtocolError(JSON_RPC_INVALID_REQUEST, 'Invalid JSON-RPC message.')
  }

  if (message.jsonrpc !== JSON_RPC_VERSION) {
    throw new McpProtocolError(JSON_RPC_INVALID_REQUEST, 'Only JSON-RPC 2.0 is supported.')
  }

  if (typeof message.method !== 'string' || !message.method) {
    throw new McpProtocolError(JSON_RPC_INVALID_REQUEST, 'Request method must be a non-empty string.')
  }
}

function ensureOperationReady(state, method) {
  if (method === 'ping' || method === 'initialize') return

  if (state.phase === 'pre_initialize') {
    throw new McpProtocolError(MCP_NOT_INITIALIZED, 'The client must call initialize before other methods.')
  }

  if (state.phase === 'waiting_initialized' && method !== 'notifications/initialized') {
    throw new McpProtocolError(MCP_NOT_INITIALIZED, 'The client must send notifications/initialized before normal operations.')
  }
}

function negotiateProtocolVersion(requestedVersion, supportedProtocolVersions) {
  if (typeof requestedVersion === 'string' && supportedProtocolVersions.includes(requestedVersion)) {
    return requestedVersion
  }
  return supportedProtocolVersions[0]
}

function normalizeCapabilities(capabilities = {}) {
  return {
    tools: {
      listChanged: false,
      ...(capabilities.tools || {})
    },
    ...capabilities
  }
}

function normalizeToolRegistry({ tools, toolRegistry }) {
  if (toolRegistry) return toolRegistry
  const definitions = Array.isArray(tools) ? [...tools] : []
  const byName = new Map(definitions.map(tool => [tool.name, tool]))
  return {
    definitions,
    get(name) {
      return byName.get(name) || null
    },
    list() {
      return { tools: definitions }
    }
  }
}

export function runMcpServer({
  serverInfo,
  instructions,
  capabilities,
  tools,
  toolRegistry,
  callTool,
  supportedProtocolVersions = SUPPORTED_PROTOCOL_VERSIONS
}) {
  const registry = normalizeToolRegistry({ tools, toolRegistry })
  const state = {
    phase: 'pre_initialize',
    protocolVersion: supportedProtocolVersions[0]
  }

  let buffer = ''
  let stdinEnded = false
  let inFlight = 0
  let writeQueue = Promise.resolve()

  function maybeExit() {
    if (stdinEnded && inFlight === 0) {
      process.exit(0)
    }
  }

  async function executeTool(message) {
    const name = message?.params?.name
    const args = message?.params?.arguments || {}
    const toolEntry = registry.get(name)

    if (!toolEntry) {
      throw new McpProtocolError(JSON_RPC_METHOD_NOT_FOUND, `Unknown tool: ${name}`)
    }

    const run = async () => {
      try {
        const result = callTool
          ? await callTool(name, args, toolEntry.definition || toolEntry)
          : await registry.call(name, args)
        return sendResult(message.id, buildToolResultPayload(result, name))
      } catch (error) {
        return sendResult(message.id, {
          isError: true,
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown tool error'
            }
          ]
        })
      }
    }

    const annotations = toolEntry.definition?.annotations || toolEntry.annotations

    if (annotations?.readOnlyHint) {
      return run()
    }

    const task = writeQueue.then(run)
    writeQueue = task.catch(() => undefined)
    return task
  }

  async function handleInitialize(message) {
    if (message.id === undefined) {
      throw new McpProtocolError(JSON_RPC_INVALID_REQUEST, 'initialize must include an id.')
    }

    const requestedVersion = message?.params?.protocolVersion
    const protocolVersion = negotiateProtocolVersion(requestedVersion, supportedProtocolVersions)
    state.phase = 'waiting_initialized'
    state.protocolVersion = protocolVersion

    return sendResult(message.id, {
      protocolVersion,
      capabilities: normalizeCapabilities(capabilities),
      serverInfo,
      ...(instructions ? { instructions } : {})
    })
  }

  async function handleRequest(message) {
    ensureRequestShape(message)
    const { id, method } = message

    if (method === 'initialize') {
      return handleInitialize(message)
    }

    ensureOperationReady(state, method)

    if (method === 'notifications/initialized') {
      state.phase = 'initialized'
      return
    }

    if (method === 'ping') {
      if (id === undefined) return
      return sendResult(id, {})
    }

    if (method === 'tools/list') {
      if (id === undefined) {
        throw new McpProtocolError(JSON_RPC_INVALID_REQUEST, 'tools/list must include an id.')
      }
      return sendResult(id, registry.list(message?.params?.cursor))
    }

    if (method === 'tools/call') {
      if (id === undefined) {
        throw new McpProtocolError(JSON_RPC_INVALID_REQUEST, 'tools/call must include an id.')
      }
      if (typeof message?.params?.name !== 'string' || !message.params.name) {
        throw new McpProtocolError(JSON_RPC_INVALID_PARAMS, 'tools/call requires a tool name.')
      }
      return executeTool(message)
    }

    throw new McpProtocolError(JSON_RPC_METHOD_NOT_FOUND, `Method not found: ${method}`)
  }

  function processMessage(message) {
    inFlight += 1
    Promise.resolve(handleRequest(message))
      .catch(error => {
        if (error instanceof McpProtocolError) {
          if (message?.id !== undefined || error.code === JSON_RPC_PARSE_ERROR) {
            sendError(message?.id, error.code, error.message, error.data)
          }
          return
        }

        if (message?.id !== undefined) {
          sendError(message.id, JSON_RPC_INTERNAL_ERROR, error instanceof Error ? error.message : 'Internal error')
        }
      })
      .finally(() => {
        inFlight -= 1
        maybeExit()
      })
  }

  function processLine(line) {
    const raw = line.trim()
    if (!raw) return

    let message
    try {
      message = JSON.parse(raw)
    } catch {
      sendError(undefined, JSON_RPC_PARSE_ERROR, 'Parse error')
      return
    }

    if (Array.isArray(message)) {
      if (message.length === 0) {
        sendError(undefined, JSON_RPC_INVALID_REQUEST, 'Batch requests must not be empty.')
        return
      }
      for (const item of message) {
        processMessage(item)
      }
      return
    }

    processMessage(message)
  }

  process.stdin.setEncoding('utf8')

  process.stdin.on('data', chunk => {
    buffer += chunk

    while (true) {
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex === -1) break

      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '')
      buffer = buffer.slice(newlineIndex + 1)
      processLine(line)
    }
  })

  process.stdin.on('end', () => {
    const trailing = buffer.trim()
    if (trailing) {
      processLine(trailing)
    }
    stdinEnded = true
    maybeExit()
  })
}
