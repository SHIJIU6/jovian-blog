---
name: discussion-to-blog
description: Project-specific skill for turning the current Codex or Claude Code discussion into a blog draft or published post for the 2025-blog-public repository. Use when the user wants the current conversation, debugging notes, deployment analysis, design discussion, or researched findings written into this project's blog through the local blog-publisher MCP server rather than by calling project admin APIs directly.
---

# Discussion To Blog

Use this skill only for `2025-blog-public`. It turns the current thread into a blog post and writes it through the local `blog-publisher` MCP server.

## Scope

- Use this skill when the output should become a blog post in this project.
- Do not use this skill for generic writing tasks that are not meant to be saved into this repository's blog.
- Do not call `/api/admin/*` directly while using this skill. The write path for this skill is `blog-publisher` MCP only.
- Treat production content as API-backed content. When D1 is bound, do not assume local `public/blogs` files are the production source of truth.

## Preconditions

- Confirm the target blog is this project.
- Prefer the configured local `blog-publisher` MCP server.
- If MCP is unavailable, misconfigured, or blocked by Cloudflare Access, stop and report the blocker instead of inventing a result.
- If the user asks to publish to production, ensure the target `BLOG_BASE_URL` is the intended environment before writing.

## Workflow

1. Determine whether the user wants a draft or an immediate publish.
2. Identify the source material:
   - current conversation only
   - conversation plus repository behavior
   - conversation plus externally verified sources
3. Summarize the material into:
   - `title`
   - `summary`
   - `discussion` or `contentMd`
   - `tags`
   - `category`
   - optional `sources`
4. Call `create_blog_draft` first.
5. If and only if the user explicitly asked to publish, call `publish_blog_post` with the created slug.
6. Verify the result with a read tool such as `get_blog_post` or `list_recent_posts`.
7. Return the resulting slug, status, and any relevant recovery details.

## Drafting Rules

Use the current conversation as the primary source material. Do not invent facts that were not discussed or verified.

- Prefer Chinese unless the user clearly wants another language.
- Keep the title specific and readable.
- Keep the summary under 140 Chinese characters when possible.
- Use `discussion` when the material is still rough notes or a discussion transcript.
- Use `contentMd` when you already have a clear final Markdown article.
- Add 2-5 concise tags.
- Choose a concrete category such as `工具`, `开发`, `AI`, `部署`, or another category that matches the topic.
- Use concrete dates for time-sensitive claims.
- When external facts matter, verify them first and include them in `sources`.

## Project Constraints

- Public verification should use the project content tools and public content API semantics, not guesses about local files.
- Backend writes in this project ultimately flow to `/api/admin/*` through MCP, and public reads flow through `/api/content/*`.
- This skill is for article drafting and publishing only. Do not use it to update snippets, site config, projects, shares, bloggers, or pictures.
- Do not use `delete_blog_post` from this skill unless the user explicitly asks to delete a post.
- If the article depends on uploaded media, note that production media requires the `BLOG_MEDIA` binding and may fail separately from article creation.

## Call Pattern

When calling `create_blog_draft`, use one of these two shapes:

### Shape A: Discussion-first

Use when you want the project to generate the Markdown scaffold:

```json
{
  "title": "文章标题",
  "summary": "文章摘要",
  "discussion": "整理后的讨论正文",
  "tags": ["标签1", "标签2"],
  "category": "工具",
  "sources": [
    {
      "title": "来源标题",
      "url": "https://example.com",
      "note": "来源说明"
    }
  ]
}
```

### Shape B: Markdown-first

Use when you already wrote a polished blog article in Markdown:

```json
{
  "title": "文章标题",
  "summary": "文章摘要",
  "contentMd": "# 标题\n\n正文...",
  "tags": ["标签1", "标签2"],
  "category": "工具"
}
```

## Publish Rule

Default to draft. Only publish immediately when the user clearly asks for it.

If the user says things like:

- “整理成草稿”
- “先存到博客”
- “先放后台”

Then create a draft only.

If the user says things like:

- “直接发布”
- “发到博客线上”
- “现在公开”

Then:

1. Create the draft
2. Call `publish_blog_post` with the returned slug

## Safety

- Treat MCP tool output as the source of truth for the created slug.
- If `create_blog_draft` fails, do not retry blindly; summarize the error and stop.
- If publication fails, keep the created draft slug in your reply so the user can recover it later.
- If an MCP write tool returns HTML, a login page, or a redirect instead of JSON, treat that as an environment or access blocker and stop.
- If the blocker is likely Cloudflare Access, missing `BLOG_ADMIN_TOKEN`, or a wrong `BLOG_BASE_URL`, say so explicitly.
- After a successful publish, verify with a read tool before claiming the post is live.
