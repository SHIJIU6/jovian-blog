# Blog Authoring Reference

Use this reference together with [`../SKILL.md`](../SKILL.md).

## Write Shapes

### Discussion-First

Use when the source material is still conversation notes or a rough transcript.

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

### Markdown-First

Use when the article is already fully drafted in Markdown.

```json
{
  "title": "文章标题",
  "summary": "文章摘要",
  "contentMd": "# 标题\n\n正文...",
  "tags": ["标签1", "标签2"],
  "category": "工具"
}
```

## Draft And Publish Rule

- Default to draft
- Publish only when the user clearly asks to publish now

Draft-only phrases:

- “整理成草稿”
- “先存到博客”
- “先放后台”

Immediate-publish phrases:

- “直接发布”
- “发到博客线上”
- “现在公开”

## Stop Conditions

- MCP unavailable or blocked
- Wrong `BLOG_BASE_URL`
- Missing `BLOG_ADMIN_TOKEN`
- Cloudflare Access returns HTML, redirect, or login content instead of JSON
- External facts were requested but not verified yet

## Few-Shot

### Draft Only

- Extract `title`, `summary`, `discussion` or `contentMd`, `tags`, and `category`
- Call `create_blog_draft`
- Verify with `get_blog_post`

### Draft Then Publish

- Call `create_blog_draft`
- If and only if the user explicitly asked to publish, call `publish_blog_post`
- Verify with `get_blog_post`

### Stop

- If the environment is misconfigured or access is blocked, stop and describe the blocker instead of inventing a result
