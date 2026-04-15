const JSON_SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema'

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function withSchemaDefaults(schema) {
  const next = clone(schema) || { type: 'object', properties: {}, additionalProperties: false }
  if (!next.$schema) {
    next.$schema = JSON_SCHEMA_DRAFT
  }
  if (!next.type) {
    next.type = 'object'
  }
  return next
}

function createAnnotations({
  title,
  readOnly = false,
  destructive = !readOnly,
  idempotent = readOnly,
  openWorld = false
}) {
  return {
    title,
    readOnlyHint: Boolean(readOnly),
    destructiveHint: readOnly ? false : Boolean(destructive),
    idempotentHint: readOnly ? true : Boolean(idempotent),
    openWorldHint: Boolean(openWorld)
  }
}

function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url')
}

function decodeCursor(cursor) {
  if (!cursor) return 0

  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'))
    const offset = Number(parsed?.offset)
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('Cursor offset must be a non-negative integer.')
    }
    return offset
  } catch {
    throw new Error('Invalid tools/list cursor.')
  }
}

export function defineTool({
  name,
  title,
  description,
  inputSchema,
  outputSchema,
  readOnly = false,
  destructive = !readOnly,
  idempotent = readOnly,
  openWorld = false,
  execution,
  handler
}) {
  return {
    definition: {
      name,
      title,
      description,
      inputSchema: withSchemaDefaults(inputSchema),
      ...(outputSchema ? { outputSchema: withSchemaDefaults(outputSchema) } : {}),
      annotations: createAnnotations({ title, readOnly, destructive, idempotent, openWorld }),
      ...(execution ? { execution } : {})
    },
    handler
  }
}

export function createToolRegistry(entries, options = {}) {
  const pageSize = Number.isInteger(options.pageSize) && options.pageSize > 0 ? options.pageSize : 50
  const definitions = entries.map(entry => entry.definition)
  const handlers = new Map(entries.map(entry => [entry.definition.name, entry]))

  function list(cursor) {
    const offset = decodeCursor(cursor)
    const tools = definitions.slice(offset, offset + pageSize)
    const nextOffset = offset + tools.length
    return {
      tools,
      ...(nextOffset < definitions.length ? { nextCursor: encodeCursor(nextOffset) } : {})
    }
  }

  function get(name) {
    return handlers.get(name) || null
  }

  async function call(name, args) {
    const tool = get(name)
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`)
    }
    return tool.handler(args || {})
  }

  return {
    pageSize,
    definitions,
    get,
    list,
    call
  }
}

export function createEnvelopeSchema(properties, required = Object.keys(properties)) {
  return withSchemaDefaults({
    type: 'object',
    properties,
    required,
    additionalProperties: false
  })
}

export function createSummarySchema(extraProperties = {}, required = []) {
  return withSchemaDefaults({
    type: 'object',
    properties: {
      ...extraProperties
    },
    required,
    additionalProperties: true
  })
}
