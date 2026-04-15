---
name: discussion-to-shares
description: Turn the current discussion into share/resource CRUD actions for the 2025-blog-public repository through the local content-admin MCP server. Use when a user wants to inspect, create, reorder, update, or delete entries in the project's `shares` content module.
---

# Discussion To Shares

Use this skill only for `2025-blog-public`.

Read these files first:

- [`../_shared/content-authoring-rules.md`](../_shared/content-authoring-rules.md)
- [`../_shared/content-authoring-playbook.md`](../_shared/content-authoring-playbook.md)
- [`../_shared/content-module-reference.md`](../_shared/content-module-reference.md)

## Scope

- Only manage `shares`.
- Allowed tools: `list_shares`, `get_share`, `create_share`, `update_share`, `delete_share`.
- Required fields: `name`, `logo`, `url`, `description`, `tags`, `stars`.
- Optional fields: `position`.
- `logo` must be a public URL or already-hosted path.

## Execution Notes

- Resolve the exact stable `id` before calling `update_share` or `delete_share`.
- If the user only has a local image file for `logo`, stop because this phase is URL-first.
- If required fields are missing for a create request, stop and list the missing fields.
- Delete only when the user explicitly asked to delete.

## Few-Shot

- Create:
  - Read with `list_shares`.
  - If no exact match exists and fields are complete, call `create_share`.
  - Verify with `get_share`.
- Update:
  - Read first, resolve the stable `id`, then call `update_share` with only the changed fields.
  - Verify with `get_share`.
- Stop:
  - Refuse local-file-only `logo` input.
  - Refuse to guess between multiple matching shares.
