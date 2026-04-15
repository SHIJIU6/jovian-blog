---
name: discussion-to-snippets
description: Turn the current discussion into snippet CRUD actions for the 2025-blog-public repository through the local content-admin MCP server. Use when a user wants to inspect, create, reorder, update, or delete entries in the project's `snippets` content module.
---

# Discussion To Snippets

Use this skill only for `2025-blog-public`.

Read these files first:

- [`../_shared/content-authoring-rules.md`](../_shared/content-authoring-rules.md)
- [`../_shared/content-authoring-playbook.md`](../_shared/content-authoring-playbook.md)
- [`../_shared/content-module-reference.md`](../_shared/content-module-reference.md)

## Scope

- Only manage `snippets`.
- Allowed tools: `list_snippets`, `get_snippet`, `create_snippet`, `update_snippet`, `delete_snippet`.
- Required fields: `content`.
- Optional fields: `id`, `position`.
- `position` is 1-based.

## Execution Notes

- Resolve the exact stable `id` before calling `update_snippet` or `delete_snippet`.
- If required fields are missing for a create request, stop and list the missing fields.
- If multiple snippets could match, stop instead of guessing.
- Delete only when the user explicitly asked to delete.

## Few-Shot

- Create:
  - Read with `list_snippets`.
  - If no exact match exists and `content` is complete, call `create_snippet`.
  - Verify with `get_snippet`.
- Update:
  - Read first, resolve `id`, then call `update_snippet` with the changed content or position only.
  - Verify with `get_snippet`.
- Stop:
  - Refuse ambiguous targets or incomplete create requests.
