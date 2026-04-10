---
name: discussion-to-blog
description: Turn the current Codex or Claude Code discussion into a blog draft for the 2025-blog-public project. Use when the user asks to organize the current conversation, analysis, debugging session, design discussion, or implementation notes into a blog draft or publishable post, and the local blog-publisher MCP server is available.
---

# Discussion To Blog

Use this skill to transform the current discussion into a blog-ready draft and send it to the local `2025-blog-public` project through the `blog-publisher` MCP server.

## Workflow

1. Decide whether the user wants a draft or an immediate publish.
2. Summarize the current discussion into:
   - `title`
   - `summary`
   - `discussion`
   - `tags`
   - `category`
   - optional `sources`
3. Prefer creating a draft first unless the user explicitly asks to publish now.
4. Call `create_blog_draft` on the `blog-publisher` MCP server.
5. If the user explicitly wants publication, call `publish_blog_post` after draft creation succeeds.
6. Return the resulting slug and whether the post is a draft or published.

## Drafting Rules

Use the current conversation as the primary source material. Do not invent facts that were not discussed.

For the output:

- Keep the title specific and readable.
- Keep the summary under 140 Chinese characters when possible.
- Put the full organized write-up in `discussion` if you are not generating polished Markdown manually.
- Use `contentMd` only when you already have a clear final Markdown structure.
- Default category to `工具`, `开发`, `AI`, or another category that matches the topic.
- Add 2-5 concise tags.

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

Only publish immediately when the user clearly asks for it.

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
- If tool creation fails, do not retry blindly; summarize the error and stop.
- If publication fails, keep the created draft slug in your reply so the user can recover it later.
