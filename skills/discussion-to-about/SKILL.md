---
name: discussion-to-about
description: Turn the current discussion into about page updates for the 2025-blog-public repository through the local content-admin MCP server. Use when a user wants to inspect or patch the single `about` document for this repository.
---

# Discussion To About

Use this skill only for `2025-blog-public`.

Read these files first:

- [`../_shared/content-authoring-rules.md`](../_shared/content-authoring-rules.md)
- [`../_shared/content-authoring-playbook.md`](../_shared/content-authoring-playbook.md)
- [`../_shared/content-module-reference.md`](../_shared/content-module-reference.md)

## Scope

- Only manage `about`.
- Allowed tools: `get_about_page`, `update_about_page`.
- Main fields: `title`, `description`, `content`.

## Execution Notes

- Always start with `get_about_page`.
- Patch only the requested fields.
- If the requested change depends on missing content, stop and ask for the missing material instead of inventing it.

## Few-Shot

- Update:
  - Read with `get_about_page`.
  - Patch only the requested fields with `update_about_page`.
  - Verify with `get_about_page`.
- Stop:
  - If the requested rewrite lacks necessary source material, stop and explain what is missing.
