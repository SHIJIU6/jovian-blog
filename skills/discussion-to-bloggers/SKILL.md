---
name: discussion-to-bloggers
description: Turn the current discussion into blogger CRUD actions for the 2025-blog-public repository through the local content-admin MCP server. Use when a user wants to inspect, create, reorder, update, or delete entries in the project's `bloggers` content module.
---

# Discussion To Bloggers

Use this skill only for `2025-blog-public`.

Read these files first:

- [`../_shared/content-authoring-rules.md`](../_shared/content-authoring-rules.md)
- [`../_shared/content-authoring-playbook.md`](../_shared/content-authoring-playbook.md)
- [`../_shared/content-module-reference.md`](../_shared/content-module-reference.md)

## Scope

- Only manage `bloggers`.
- Allowed tools: `list_bloggers`, `get_blogger`, `create_blogger`, `update_blogger`, `delete_blogger`.
- Required fields: `name`, `avatar`, `url`, `description`, `stars`.
- Optional fields: `status`, `position`.
- `status` only supports `recent` or `disconnected`.

## Execution Notes

- Resolve the exact stable `id` before calling `update_blogger` or `delete_blogger`.
- If the user only has a local avatar file, stop because media stays URL-first in this phase.
- If required fields are missing for a create request, stop and list the missing fields.
- Delete only when the user explicitly asked to delete.

## Few-Shot

- Create:
  - Read with `list_bloggers`.
  - If no exact match exists and fields are complete, call `create_blogger`.
  - Verify with `get_blogger`.
- Update:
  - Read first, resolve `id`, then patch only the requested fields with `update_blogger`.
  - Verify with `get_blogger`.
- Stop:
  - Refuse ambiguous matches.
  - Refuse local-file-only avatar input.
