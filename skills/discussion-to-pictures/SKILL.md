---
name: discussion-to-pictures
description: Turn the current discussion into picture-group CRUD actions for the 2025-blog-public repository through the local content-admin MCP server. Use when a user wants to inspect, create, update, or delete `pictures` groups made of one or more image URLs.
---

# Discussion To Pictures

Use this skill only for `2025-blog-public`.

Read these files first:

- [`../_shared/content-authoring-rules.md`](../_shared/content-authoring-rules.md)
- [`../_shared/content-authoring-playbook.md`](../_shared/content-authoring-playbook.md)
- [`../_shared/content-module-reference.md`](../_shared/content-module-reference.md)

## Scope

- Only manage `pictures`.
- Allowed tools: `list_pictures`, `get_picture`, `create_picture`, `update_picture`, `delete_picture`.
- Required fields: `images`.
- Optional fields: `description`, `uploadedAt`.
- A `picture` is a group of image URLs. This skill does not edit single images inside a group.
- `images` must contain public URLs or already-hosted paths.

## Execution Notes

- Resolve the exact stable `id` before calling `update_picture` or `delete_picture`.
- Reject local-file-only requests because this phase is URL-first.
- Do not invent image URLs or silently drop broken entries from the request.
- Delete only when the user explicitly asked to delete.

## Few-Shot

- Create:
  - Read with `list_pictures`.
  - If the request contains valid `images` URLs, call `create_picture`.
  - Verify with `get_picture`.
- Update:
  - Read first, resolve `id`, then patch the requested fields with `update_picture`.
  - Verify with `get_picture`.
- Stop:
  - If the user only provided local files, stop and explain that direct upload is not available in this phase.
