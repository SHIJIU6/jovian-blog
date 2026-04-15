import assert from 'node:assert/strict'
import { BLOG_MCP_SERVER_INFO, BLOG_MCP_SERVER_INSTRUCTIONS, createBlogMcpToolRegistry } from './blog-mcp-definition.mjs'
import { CONTENT_MCP_SERVER_INFO, CONTENT_MCP_SERVER_INSTRUCTIONS, createContentMcpToolRegistry } from './content-mcp-definition.mjs'

function assertJsonSchema(schema, label) {
  assert(schema && typeof schema === 'object', `${label} must exist.`)
  assert.equal(typeof schema.$schema, 'string', `${label} must declare $schema.`)
  assert.equal(typeof schema.type, 'string', `${label} must declare a top-level type.`)
}

function validateRegistry(serverInfo, instructions, registry) {
  assert.equal(typeof serverInfo.name, 'string', 'Server name must be a string.')
  assert.equal(typeof serverInfo.version, 'string', 'Server version must be a string.')
  assert.equal(typeof instructions, 'string', 'Server instructions must be a string.')
  assert.ok(instructions.trim().length > 0, 'Server instructions must not be empty.')

  const names = new Set()
  for (const tool of registry.definitions) {
    assert.equal(typeof tool.name, 'string', 'Tool name must be a string.')
    assert.ok(tool.name.length > 0, 'Tool name must not be empty.')
    assert.ok(!names.has(tool.name), `Duplicate tool name: ${tool.name}`)
    names.add(tool.name)

    assert.equal(typeof tool.title, 'string', `${tool.name} must have a title.`)
    assert.ok(tool.title.trim().length > 0, `${tool.name} title must not be empty.`)
    assert.equal(typeof tool.description, 'string', `${tool.name} must have a description.`)
    assert.ok(tool.description.trim().length > 0, `${tool.name} description must not be empty.`)

    assertJsonSchema(tool.inputSchema, `${tool.name} inputSchema`)
    assertJsonSchema(tool.outputSchema, `${tool.name} outputSchema`)

    assert(tool.annotations && typeof tool.annotations === 'object', `${tool.name} must expose annotations.`)
    assert.equal(typeof tool.annotations.readOnlyHint, 'boolean', `${tool.name} must set readOnlyHint.`)
    assert.equal(typeof tool.annotations.destructiveHint, 'boolean', `${tool.name} must set destructiveHint.`)
    assert.equal(typeof tool.annotations.idempotentHint, 'boolean', `${tool.name} must set idempotentHint.`)
    assert.equal(typeof tool.annotations.openWorldHint, 'boolean', `${tool.name} must set openWorldHint.`)
  }

  const listed = registry.list()
  assert(Array.isArray(listed.tools), 'tools/list must return a tools array.')
  assert.equal(listed.tools.length, registry.definitions.length, 'tools/list should expose all tools in one page by default.')
}

const blogRegistry = createBlogMcpToolRegistry()
const contentRegistry = createContentMcpToolRegistry()

validateRegistry(BLOG_MCP_SERVER_INFO, BLOG_MCP_SERVER_INSTRUCTIONS, blogRegistry)
validateRegistry(CONTENT_MCP_SERVER_INFO, CONTENT_MCP_SERVER_INSTRUCTIONS, contentRegistry)

console.log(`Validated ${blogRegistry.definitions.length + contentRegistry.definitions.length} MCP tools.`)
