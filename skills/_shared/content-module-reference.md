# Content Module Reference

Use this reference together with:

- [`./content-authoring-rules.md`](./content-authoring-rules.md)
- [`./content-authoring-playbook.md`](./content-authoring-playbook.md)

Read only the module section you need.

## Projects

- Tools: `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project`
- Required fields: `name`, `year`, `image`, `url`, `description`, `tags`
- Optional fields: `github`, `npm`, `position`
- Notes:
  - `position` is 1-based
  - `image` must be a public URL or already-hosted path

## Shares

- Tools: `list_shares`, `get_share`, `create_share`, `update_share`, `delete_share`
- Required fields: `name`, `logo`, `url`, `description`, `tags`, `stars`
- Optional fields: `position`
- Notes:
  - `logo` must be a public URL or already-hosted path

## Bloggers

- Tools: `list_bloggers`, `get_blogger`, `create_blogger`, `update_blogger`, `delete_blogger`
- Required fields: `name`, `avatar`, `url`, `description`, `stars`
- Optional fields: `status`, `position`
- Notes:
  - `status` only supports `recent` or `disconnected`
  - `avatar` must be a public URL or already-hosted path

## Pictures

- Tools: `list_pictures`, `get_picture`, `create_picture`, `update_picture`, `delete_picture`
- Required fields: `images`
- Optional fields: `description`, `uploadedAt`
- Notes:
  - A `picture` is one group of image URLs
  - This phase does not support editing individual images inside one group
  - Every `images` entry must be a public URL or already-hosted path

## Snippets

- Tools: `list_snippets`, `get_snippet`, `create_snippet`, `update_snippet`, `delete_snippet`
- Required fields: `content`
- Optional fields: `id`, `position`
- Notes:
  - `position` is 1-based

## Site Config

- Read tool: `get_site_config`
- Update tools:
  - `update_site_meta`
  - `update_site_theme`
  - `update_site_images`
  - `update_site_social_buttons`
  - `update_site_preferences`
  - `update_card_styles`
- Notes:
  - Patch only one section unless the user explicitly asks for more
  - Do not replace the whole site config by default
  - `faviconUrl`, `avatarUrl`, `artImages`, and `backgroundImages` are URL-first

## About

- Tools: `get_about_page`, `update_about_page`
- Main fields: `title`, `description`, `content`
- Notes:
  - Treat it as one single document
