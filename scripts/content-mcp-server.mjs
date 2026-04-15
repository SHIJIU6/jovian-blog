#!/usr/bin/env node

/**
 * Reference: Model Context Protocol stdio transport and lifecycle docs
 * (protocol revision 2025-11-25, checked on 2026-04-15).
 */

import { runMcpServer } from './mcp-runtime.mjs'
import {
  CONTENT_MCP_SERVER_INFO,
  CONTENT_MCP_SERVER_INSTRUCTIONS,
  createContentMcpToolRegistry
} from './content-mcp-definition.mjs'

runMcpServer({
  serverInfo: CONTENT_MCP_SERVER_INFO,
  instructions: CONTENT_MCP_SERVER_INSTRUCTIONS,
  toolRegistry: createContentMcpToolRegistry()
})
