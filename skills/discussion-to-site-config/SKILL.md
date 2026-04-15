---
name: discussion-to-site-config
description: Turn the current discussion into site config section patches for the 2025-blog-public repository through the local content-admin MCP server. Use when a user wants to inspect or patch `meta`, `theme`, `images`, `socialButtons`, `preferences`, or `cardStyles` without replacing the entire site config.
---

# Discussion To Site Config

Use this skill only for `2025-blog-public`.

Read these files first:

- [`../_shared/content-authoring-rules.md`](../_shared/content-authoring-rules.md)
- [`../_shared/content-authoring-playbook.md`](../_shared/content-authoring-playbook.md)
- [`../_shared/content-module-reference.md`](../_shared/content-module-reference.md)

## Scope

- Only manage `site-config`.
- Allowed tools: `get_site_config`, `update_site_meta`, `update_site_theme`, `update_site_images`, `update_site_social_buttons`, `update_site_preferences`, `update_card_styles`.
- Patch only the requested section. Do not replace the whole site config unless the user explicitly asks for a full overwrite.
- `faviconUrl`, `avatarUrl`, art images, and background images must be URL-first.

## Execution Notes

- Always start with `get_site_config`.
- Pick the smallest matching section tool. Do not use multiple section updates when one tool is enough.
- Reject local-file-only media requests in this phase.
- Do not convert a section patch request into a whole-object overwrite.

## Few-Shot

- Theme patch:
  - Read with `get_site_config`.
  - Call `update_site_theme` with only the changed theme fields.
  - Verify with `get_site_config`.
- Social buttons patch:
  - Read first.
  - Call `update_site_social_buttons` with the requested button set only.
  - Verify with `get_site_config`.
- Stop:
  - Refuse local-file-only favicon/avatar/background image requests.
  - Refuse whole-config overwrite unless the user clearly asked for it.
