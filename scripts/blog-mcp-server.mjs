#!/usr/bin/env node

/**
 * Reference: Model Context Protocol stdio transport and lifecycle docs
 * (protocol revision 2025-11-25, checked on 2026-04-15).
 */

import { runMcpServer } from './mcp-runtime.mjs'
import {
  BLOG_MCP_SERVER_INFO,
  BLOG_MCP_SERVER_INSTRUCTIONS,
  createBlogMcpToolRegistry
} from './blog-mcp-definition.mjs'

runMcpServer({
  serverInfo: BLOG_MCP_SERVER_INFO,
  instructions: BLOG_MCP_SERVER_INSTRUCTIONS,
  toolRegistry: createBlogMcpToolRegistry()
})
