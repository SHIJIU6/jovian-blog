# Jovian Blog

一个适合二次开发的博客/CMS 模板，基于 **Next.js + OpenNext + Cloudflare**，内置：

- 前台展示页面
- `/studio` 后台工作区
- 服务端内容 API
- 媒体上传与本地/Cloudflare 回退链路
- 本地 `stdio MCP` 博客工具服务器

该仓库已整理为**公开模板版本**：

- 移除了个人测试文章与示例运行痕迹
- 默认站点信息改为中性占位内容
- `.env`、本地日志、MCP 私有配置和本地上传文件不会纳入版本控制
- 仓库不再保存模板文章内容；本地开发产生的内容、媒体和审计回退统一写入 `.local-content/`

## 功能概览

### 前台

- 首页卡片化布局
- 博客列表与详情
- 项目页
- 资源页
- 博主页
- 图片页
- 短句页

### 后台 `/studio`

- 站点设置
- 写文章
- 文章管理
- 项目管理
- 资源管理
- 博主管理
- 图片管理
- 短句管理
- 审计日志

### 服务端能力

- `/api/content/*` 统一读取内容
- `/api/admin/*` 统一后台写入
- 本地文件回退
- D1 / R2 优先架构预留
- 本地 `stdio MCP` 博客工具

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Motion
- OpenNext Cloudflare
- Wrangler

## 项目结构

```text
src/
  app/
    (home)/              首页卡片与配置
    api/                 内容与管理接口
    studio/              后台工作区
    blog/                博客列表与详情
    projects/            项目
    share/               资源
    bloggers/            博主
    pictures/            图片
    snippets/            短句
  lib/
    server/              服务端内容层、后台写入层、AI/MCP辅助层
seeds/
  content/               模板结构化内容
public/
  images/                默认静态资源（生产可直接发布）
  music/                 默认音频资源
  favicon.png            默认站点图标
  manifest.json          默认站点清单
.local-content/          本地开发运行数据（gitignored）
  content/               本地结构化内容与文章
  media/                 本地媒体与站点资源
  runtime/               审计等运行时回退
migrations/              D1 migrations
scripts/
  blog-mcp-server.mjs    本地 stdio MCP server
skills/
  discussion-to-blog/    讨论整理成博客草稿的 skill
```

## 本地开发

### 1. 安装依赖

```bash
pnpm i
```

### 2. 启动开发环境

```bash
pnpm dev
```

如果你希望本地开发直接走 D1，而不是 `.local-content` 文件回退，先执行一次本地 migration：

```bash
pnpm db:migrate:local
```

默认端口：

```text
http://127.0.0.1:2025
```

### 3. 构建验证

```bash
pnpm build
```

说明：

- 如果你的机器内存较小，`next build` 在最后阶段可能因为 Node 内存不足失败
- 本地开发与功能调试优先使用 `pnpm dev`
- 如果本地 D1 尚未初始化，文章和后台结构化内容保存会自动回退到 `.local-content/`；需要验证 D1 路径时请先执行 `pnpm db:migrate:local`

### 4. 类型检查与仓库校验

```bash
pnpm typecheck
pnpm check
```

说明：

- `pnpm typecheck` 会先执行 `next typegen`，再做 TypeScript 静态检查
- `pnpm check` 会顺序执行类型检查和生产构建
- 仓库已附带 GitHub Actions CI，推送到 GitHub 后会自动执行上述校验

## 环境变量

项目提供了 [`.env.example`](./.env.example) 作为公开模板的环境变量样板。

常用变量分组如下：

- 站点地址：
  - `SITE_URL`
  - `NEXT_PUBLIC_SITE_URL`
- 后台权限：
  - `ADMIN_ALLOWLIST`
  - `BLOG_ADMIN_TOKEN`
  - `BLOG_LOCAL_ADMIN_BYPASS`
- AI 草稿：
  - `AI_PROVIDER`
  - `OPENAI_API_KEY`
  - `OPENAI_RESPONSES_MODEL`
- 可选前台能力：
  - `NEXT_PUBLIC_LIKE_ENDPOINT`（默认内置为 `/api/likes`，仅在接第三方点赞服务时覆盖）
  - `NEXT_PUBLIC_SAMPLE_AUDIO`（可选，支持单个 URL 或逗号分隔多个 URL；未配置时会优先使用构建期生成的 `public/music/` 音频清单，本地开发仍可直接发现新文件）
  - `BLOG_SLUG_KEY`

## 点赞实现

- 项目现已内置点赞接口 `/api/likes`，无需再额外部署第三方服务才能显示或记录点赞数
- 点赞按命名空间 key 计数（如 `post:slug`、`page:about`、`site:home`），避免文章和页面之间 slug 冲突
- 对同一访客在同一天内对同一目标做去重限制
- 开发环境默认持久化到 `.local-content/runtime/likes/likes.json`
- 生产环境优先持久化到 Cloudflare D1：`like_daily_votes` 负责去重记录，`like_counters` 负责聚合计数
- D1 读路径会优先命中聚合计数表，并在发现旧数据只有投票明细时自动回填聚合计数
- 如果你在 Cloudflare 上部署，需要执行最新迁移以创建/补齐点赞表：
  - `pnpm db:migrate:local`
  - `pnpm db:migrate:remote`
- 本地 MCP：
  - `BLOG_BASE_URL`
  - `BLOG_ADMIN_EMAIL`
  - `BLOG_ADMIN_TOKEN`
  - `CF_ACCESS_CLIENT_ID`（可选，用于通过 Cloudflare Access）
  - `CF_ACCESS_CLIENT_SECRET`（可选，用于通过 Cloudflare Access）

## 内容管理说明

### 文章

- `/studio/write`：创建文章
- `/studio/write/[slug]`：编辑单篇文章
- `/studio/blog`：文章管理

当前支持状态：

- `draft`
- `published`
- `offline`

### 短句

- `/studio/snippets`：后台列表管理
- `/snippets`：前台展示
- 首页已接入短句卡片轮播

## 本地与生产隔离

- GitHub 仓库只存模板代码、`seeds/content/` 模板数据、`public/` 默认静态资源和迁移脚本
- 本地开发时，文章与结构化内容写入 `.local-content/content/`，上传媒体写入 `.local-content/media/`
- 生产环境接入 D1 / R2 后，读写优先走云端绑定，不依赖本地回退目录
- 前台默认静态资源直接由 `public/` 提供，保证本地开发和 Cloudflare 生产部署都能稳定访问
- 旧的 `.local-content/src/*` 与 `.local-content/public/*` 会在运行时自动迁移到新目录，迁移后运行链路只使用新结构

## Cloudflare 部署

这个项目可以部署到 **Cloudflare Workers**，不是只能部署到传统服务器。

### 当前推荐部署形态

- GitHub：存代码
- Cloudflare Workers：跑项目
- D1：存内容
- R2：存媒体
- Cloudflare Access：保护后台（推荐）

### 1. 登录 Cloudflare

```bash
pnpm wrangler login
```

### 2. 创建 D1 数据库

在 Cloudflare Dashboard 中：

1. 打开 `D1 SQL Database`
2. 点击 `Create Database`
3. 创建一个数据库，例如：
   - `blog-content-prod`

### 3. 创建 R2 Bucket

在 Cloudflare Dashboard 中：

1. 打开 `R2`
2. 点击 `Create bucket`
3. 创建一个 bucket，例如：
   - `blog-media-prod`

### 4. 修改 `wrangler.toml`

打开 [wrangler.toml](./wrangler.toml)，填入真实绑定：

```toml
[[d1_databases]]
binding = "BLOG_DB"
database_name = "blog-content-prod"
database_id = "your-d1-database-id"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "BLOG_MEDIA"
bucket_name = "blog-media-prod"
```

### 5. 应用 migrations

```bash
pnpm db:migrate:remote
```

### 6. 配置 Secret

至少建议配置：

```bash
pnpm wrangler secret put BLOG_ADMIN_TOKEN
```

如果以后线上要接真实 AI：

```bash
pnpm wrangler secret put OPENAI_API_KEY
pnpm wrangler secret put OPENAI_RESPONSES_MODEL
```

### 7. 本地 Cloudflare 预演

```bash
pnpm build:cf
pnpm preview
```

### 8. 正式部署

```bash
pnpm deploy
```

## GitHub 集成部署

如果你需要：

- 提交代码自动触发部署
- 在 Cloudflare 面板里看 Git 提交历史
- 多机器协作

那么建议：

1. 把代码推送到 GitHub 远程仓库
2. 在 Cloudflare `Workers & Pages` 中连接 GitHub 仓库
3. 配置构建命令：

```bash
pnpm run build:cf
```

当前项目不要求先部署到 GitHub 才能本地或手动部署，但**自动部署和协作**需要 GitHub 远程仓库。

## 本地 MCP 使用

这个项目已经附带一个本地 `stdio MCP` server：

```bash
pnpm mcp:blog
```

它当前暴露的工具包括：

- `create_blog_draft`
- `publish_blog_post`
- `get_blog_post`
- `list_recent_posts`
- `search_blog_posts`
- `delete_blog_post`

### Codex 安装本地 MCP

```bash
codex mcp add blog-publisher --env BLOG_BASE_URL=http://127.0.0.1:2025 --env BLOG_ADMIN_TOKEN=replace-with-a-long-random-token -- node D:\IDEA\Project\2025-blog-public\scripts\blog-mcp-server.mjs
```

### Claude Code 安装本地 MCP

项目附带示例配置：

- [`.mcp.json.example`](./.mcp.json.example)

也可以按 Claude Code 的本地 MCP 方式配置：

- command: `node`
- args: `scripts/blog-mcp-server.mjs`
- env:
  - `BLOG_BASE_URL`
  - `BLOG_ADMIN_TOKEN`
  - `CF_ACCESS_CLIENT_ID`（如果 `/api/admin/*` 受 Cloudflare Access 保护）
  - `CF_ACCESS_CLIENT_SECRET`（如果 `/api/admin/*` 受 Cloudflare Access 保护）

### 生产环境 + Cloudflare Access 场景

如果你把 `/api/admin/*` 放在 Cloudflare Access 后面，`blog-publisher` MCP 需要两层凭据：

- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`
- `BLOG_ADMIN_TOKEN`

含义分别是：

- `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`：让 MCP 请求先通过 Cloudflare Access 边缘校验
- `BLOG_ADMIN_TOKEN`：让项目应用层后台鉴权通过

仅配置其中一层通常不够：

- 只有 Access Service Token：请求能穿过 Access，但应用层仍可能返回 `Unauthorized`
- 只有 `BLOG_ADMIN_TOKEN`：应用层能识别，但请求可能在 Access 边缘就被拦住

推荐的 Codex 配置示例：

```bash
codex mcp add blog-publisher \
  --env BLOG_BASE_URL=https://blog.example.com \
  --env BLOG_ADMIN_TOKEN=replace-with-a-long-random-token \
  --env CF_ACCESS_CLIENT_ID=your-access-client-id \
  --env CF_ACCESS_CLIENT_SECRET=your-access-client-secret \
  -- node D:\IDEA\Project\2025-blog-public\scripts\blog-mcp-server.mjs
```

## Skill

项目附带一个可以继续扩展的 skill：

- [`skills/discussion-to-blog`](./skills/discussion-to-blog/SKILL.md)

作用：

- 把当前讨论整理成博客草稿结构
- 再调用 `create_blog_draft`
- 如果用户明确要求公开，再调用 `publish_blog_post`

典型话术：

> 把我们刚才讨论整理成博客草稿并写入项目

## 安全建议

### 本地开发

- `localhost / 127.0.0.1` 默认放行后台接口
- 方便调试和本地 MCP 测试

### 生产环境

不要裸开放 `/api/admin/*`。

推荐至少启用以下之一：

- `BLOG_ADMIN_TOKEN`
- Cloudflare Access
- `admins` 表角色校验

当前项目已经支持：

- 本地放行
- `BLOG_ADMIN_TOKEN`
- Cloudflare Access 邮箱头识别
- Cloudflare Access Service Token（供本地 MCP 访问受保护的 `/api/admin/*`）
- `admins` 表管理员判断

## 开源模板注意事项

该模板已经尽量去除了个人化默认信息，但你在公开自己的站点前，仍建议手动检查这些文件并替换成自己的内容：

- [seeds/content/site-content.json](./seeds/content/site-content.json)
- [seeds/content/about.json](./seeds/content/about.json)
- [seeds/content/projects.json](./seeds/content/projects.json)
- [seeds/content/shares.json](./seeds/content/shares.json)
- [seeds/content/bloggers.json](./seeds/content/bloggers.json)
- [seeds/content/snippets.json](./seeds/content/snippets.json)
- [seeds/content/pictures.json](./seeds/content/pictures.json)
- [seeds/content/card-styles.json](./seeds/content/card-styles.json)
- [public/images/avatar.png](./public/images/avatar.png)
- [public/favicon.png](./public/favicon.png)

## 不会被提交到仓库的文件

这些文件默认被 `.gitignore` 排除：

- `.env*`
- `.mcp.json`
- `.mcp-test-output.txt`
- `.dev-stdout.log`
- `.dev-stderr.log`
- `.start-stdout.log`
- `.start-stderr.log`
- `.local-content/`
- `project_document_local/`

## License

请按你的实际需要决定使用的 License。当前仓库保留原始 `LICENSE` 文件，你可以根据自己的开源策略调整。
