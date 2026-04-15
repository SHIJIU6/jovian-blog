---
name: discussion-to-projects
description: Turn the current discussion into project CRUD actions for the 2025-blog-public repository through the local content-admin MCP server. Use when a user wants to inspect, create, reorder, update, or delete entries in the project's `projects` content module.
---

# Discussion To Projects

Use this skill only for `2025-blog-public`.

Read these files first:

- [`../_shared/content-authoring-rules.md`](../_shared/content-authoring-rules.md)
- [`../_shared/content-authoring-playbook.md`](../_shared/content-authoring-playbook.md)
- [`../_shared/content-module-reference.md`](../_shared/content-module-reference.md)

## Scope

- Only manage `projects`.
- Allowed tools: `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project`.
- Required fields: `name`, `year`, `image`, `url`, `description`, `tags`.
- Optional fields: `github`, `npm`, `position`.
- `position` is 1-based.

## Execution Notes

- Resolve the exact stable `id` before calling `update_project` or `delete_project`.
- If required fields are missing for a create request, stop and list the missing fields.
- If more than one project could match, stop instead of guessing.
- Delete only when the user explicitly asked to delete.

## Few-Shot

- Create:
  - Read with `list_projects`.
  - If no exact match exists and required fields are complete, call `create_project`.
  - Verify with `get_project`.
- Update:
  - Read with `list_projects` or `get_project`.
  - Resolve the stable `id`.
  - Patch only the requested fields with `update_project`.
  - Verify with `get_project`.
- Stop:
  - If the target is ambiguous or required fields are missing, stop with a concise explanation.
