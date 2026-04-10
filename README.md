# 2025 Blog

> 2026-04 更新：当前项目推荐架构已经切换为“GitHub 只存代码，内容通过 `/studio` + 服务端 API + D1/R2 管理”。

## 当前推荐方案

当前版本的推荐用法：

1. 使用 Cloudflare + OpenNext 部署站点代码。
2. 在 `wrangler.toml` 中配置 `BLOG_DB` 和 `BLOG_MEDIA`。
3. 执行 `migrations/` 中的 D1 migration。
4. 使用 Cloudflare Access 保护 `/studio/*`。
5. 在线上通过 D1 `admins` 表维护后台管理员；在过渡阶段可回退到 `ADMIN_ALLOWLIST`。
6. 进入 `/studio` 管理文章、站点配置、项目、资源、图片和短句。

### 当前内容链路

- GitHub：只存代码
- D1：存文章、结构化内容、管理员、审计日志
- R2：存图片和媒体资源
- `/api/admin/*`：统一处理后台写入
- `/api/content/*`：统一处理前台读取

### 当前状态说明

- 旧的 **GitHub App + Private Key + 前端直连 GitHub API** 内容写入方案已经不再是推荐主路径。
- 仓库内仍保留了一些历史说明和截图，主要用于回溯旧版本来源。
- 如果你准备继续完善这个项目，请优先沿着 D1 / R2 / Cloudflare Access / `/studio` 这条路线推进。

### 当前本地 AI 草稿测试

当前版本已经接入一版本地可验证的 AI 草稿生成链路：

- 后台入口：`/studio/write`
- 服务端接口：
  - `POST /api/admin/ai/research-topic`
  - `POST /api/admin/ai/generate-post`
- 本地未配置 `OPENAI_API_KEY` 时，会自动回退到 mock 模式，便于先验证“AI 草稿 -> 编辑 -> 发布”的完整链路。
- 配置真实模型时，可设置：
  - `OPENAI_API_KEY`
  - `OPENAI_RESPONSES_MODEL`（可选，默认 `gpt-5`）

### 当前外部工具 / MCP 集成方向

如果你的目标不是“在网站里点按钮生成文章”，而是：

- 在 Codex / GPT / Claude 里讨论问题
- 再要求 AI 把当前讨论整理进博客

那么当前项目更推荐的用法是：

- 把本项目作为 **博客发布网关**
- 让本地 MCP Server / Skill / Agent 直接调用本项目后台接口

当前已经提供适合外部工具调用的文章接口：

- `POST /api/admin/posts/create-draft`
- `POST /api/admin/posts/publish-draft`

典型本地流程：

1. 在 Codex / GPT / Claude 中完成讨论
2. 模型整理出标题、摘要、正文、标签、来源
3. 通过 MCP tool 或本地脚本调用 `create-draft`
4. 如需人工审核，可在 `/studio/blog` 或 `/studio/write` 中继续编辑
5. 审核完成后再调用 `publish-draft`

这一条路线优先级高于“先把 AI 塞进网站页面”，也更适合后续升级为：

- 本地 `stdio MCP`
- 远程 `Streamable HTTP MCP`
- ChatGPT / Claude / Codex 统一工具接入

### 本地 stdio MCP 使用

当前项目已经提供一个本地 `stdio MCP` server：

```bash
pnpm mcp:blog
```

它当前暴露的工具包括：

- `create_blog_draft`
- `publish_blog_post`
- `get_blog_post`
- `list_recent_posts`
- `delete_blog_post`
- `search_blog_posts`

#### 标准 MCP 是怎么做出来的

对这个项目来说，一个标准 MCP server 的制作顺序应该是：

1. **先有稳定的项目服务端能力**
   - 例如草稿创建、草稿发布、内容读取、资源上传
   - 这些能力应先落在项目自己的 `/api/admin/*` 与 service 层里

2. **再把这些能力封装成 MCP tools**
   - MCP 不直接操作数据库或页面 UI
   - MCP 只调用项目自己的后台接口

3. **最后再用 Skill 包装高频工作流**
   - Skill 负责提示模型如何把当前讨论整理成标题、摘要、正文、标签和来源
   - MCP 负责真正执行

也就是说，这个项目的最优结构不是 “只做 skill + MCP”，而是：

- **项目接口 / 服务层**：唯一真实执行层
- **MCP server**：本地或远程工具适配层
- **Skill**：对话工作流包装层

#### MCP 安装与适配方式

##### 方式 1：Codex 本地添加 stdio MCP

当前环境下可以直接添加：

```bash
codex mcp add blog-publisher --env BLOG_BASE_URL=http://127.0.0.1:2025 --env BLOG_ADMIN_EMAIL=owner@example.com --env BLOG_ADMIN_TOKEN=replace-with-a-long-random-token -- node D:\IDEA\Project\2025-blog-public\scripts\blog-mcp-server.mjs
```

查看已配置的 MCP：

```bash
codex mcp list
```

##### 方式 2：Claude Code / 支持 `.mcp.json` 的本地客户端

项目中已经附带可直接参考的配置文件：

- [`.mcp.json.example`](D:/IDEA/Project/2025-blog-public/.mcp.json.example)

你可以复制为本地实际配置，然后把 token 和邮箱换成你自己的值。

配置核心是：

- command: `node`
- args: `scripts/blog-mcp-server.mjs`
- env:
  - `BLOG_BASE_URL`
  - `BLOG_ADMIN_EMAIL`
  - `BLOG_ADMIN_TOKEN`

#### Skill 位置与用途

项目中已经附带一个可继续使用/调整的 Skill：

- [discussion-to-blog](D:/IDEA/Project/2025-blog-public/skills/discussion-to-blog/SKILL.md)

作用：

- 自动把当前讨论整理成博客草稿结构
- 再调用 `create_blog_draft`
- 如果用户明确要求公开，再继续调用 `publish_blog_post`

当前 Skill 面向的目标话术是：

- “把我们刚才讨论整理成博客草稿并写入项目”
- “把这次分析整理成一篇博客草稿”
- “把当前调试过程整理后发到博客后台”

如果你要做文章检索与删除，推荐的话术是：

- “先看看当前博客里有哪些 MCP 相关文章”
- “把标题包含 xxx 的文章列出来”
- “删除 slug 为 xxx 的文章”

#### 本地安装 / 适配思路

标准的本地 MCP 制作方式是：

1. 让项目本身先具备稳定的服务端能力
2. 再用一个本地 `stdio` 进程把这些能力封装成 MCP tools
3. 让 Codex / Claude Code / 其他本地 agent 工具通过 MCP 调用

对这个项目来说，最优做法不是把业务直接写在 Skill 里，而是：

- **博客项目本身**：作为发布网关
- **MCP server**：作为工具适配层
- **Skill**：作为高频工作流包装层

也就是说：

- `Skill` 负责“怎么用”
- `MCP` 负责“怎么调工具”
- `/api/admin/*` 负责“真正执行”

#### 环境变量

- `BLOG_BASE_URL`
  - 默认：`http://127.0.0.1:2025`
- `BLOG_ADMIN_EMAIL`
  - 可选，给服务端传递管理员邮箱头
- `BLOG_ADMIN_TOKEN`
  - 可选，给服务调用增加 Bearer Token
- `BLOG_LOCAL_ADMIN_BYPASS`
  - 默认：`true`
  - 设置为 `false` 后，本地 `localhost` 也不再自动放行，必须使用 token 或管理员身份

#### 安全建议

本地开发时：

- `localhost / 127.0.0.1` 默认允许进入后台和调用管理接口
- 因此本地测试 MCP 时可以不配置 token
- 如果你希望本地也强制鉴权，可设置 `BLOG_LOCAL_ADMIN_BYPASS=false`

后续部署到生产环境时：

- 不应裸开放 MCP 对应的管理接口
- 推荐至少启用以下任一方案：
- Cloudflare Access + `admins` 表
- `BLOG_ADMIN_TOKEN` 服务级 Bearer Token
- Cloudflare Access + 服务 token 组合

当前项目已经支持：

- 本地放行
- Cloudflare Access 邮箱头识别
- `admins` 表管理员校验
- `BLOG_ADMIN_TOKEN` 服务级 token 校验

因此后期如果把 MCP server 部署成远程版本，不需要让它直接碰数据库，
只需要让它携带 token 调用本项目后台接口即可。

#### 一句话工作流示例

当你已经把本地 MCP 配好，并让 Skill 生效后，目标工作流就是：

> “把我们刚才讨论整理成博客草稿并写入项目”

然后流程会变成：

1. 模型读取当前讨论上下文
2. Skill 指导模型整理出：
   - title
   - summary
   - discussion 或 contentMd
   - tags
   - category
   - sources
3. 调用 `create_blog_draft`
4. 返回 slug 和草稿状态

如果你再说：

> “把刚才那篇草稿直接发布”

则可以继续调用 `publish_blog_post`

如果你要删除文章，推荐先让模型执行：

1. `search_blog_posts`
2. 或 `list_recent_posts`
3. 再由你指定标题或 slug
4. 然后调用 `delete_blog_post`

这样可以避免模型直接删除错误文章。

## 快速启动（当前方案）

1. 安装依赖：`pnpm i`
2. 本地开发：`pnpm dev`
3. 构建验证：`pnpm build`
4. Cloudflare 构建：`pnpm build:cf`
5. 配置 D1 / R2 bindings 后部署

## 历史 GitHub App 流程（仅保留参考，不再推荐）

> 最新旧版引导说明：https://www.yysuni.com/blog/readme

## 1. 安装

使用该项目可以先不做本地开发，直接部署然后配置环境变量。具体变量名请看下列大写变量

```ts
export const GITHUB_CONFIG = {
	OWNER: process.env.NEXT_PUBLIC_GITHUB_OWNER || 'yysuni',
	REPO: process.env.NEXT_PUBLIC_GITHUB_REPO || '2025-blog-public',
	BRANCH: process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main',
	APP_ID: process.env.NEXT_PUBLIC_GITHUB_APP_ID || '-'
} as const
```

也可以自己手动先调整安装，可自行 `pnpm i`

## 2. 部署

我这里熟悉 Vercel 部署，就以 Vercel 部署为例子。创建 Project => Import 这个项目

![](https://www.yysuni.com/blogs/readme/730266f17fab9717.png)

无需配置，直接点部署

![](https://www.yysuni.com/blogs/readme/95dee9a69154d0d0.png)

大约 60 秒会部署完成，有一个直接 vercel 域名，如：https://2025-blog-public.vercel.app/

到这里部署网站已经完成了，下一步创建 Github App

## 3. 创建 Github App 链接仓库

在 github 个人设置里面，找到最下面的 Developer Settings ，点击进入

![](https://www.yysuni.com/blogs/readme/0abb3b592cbedad6.png)

进入开发者页面，点击 **New Github App**

*GitHub App name* 和 *Homepage URL* , 输入什么都不影响。Webhook 也关闭，不需要。

![](https://www.yysuni.com/blogs/readme/71dcd9cf8ec967c0.png)

只需要注意设置一个仓库 write 权限，其它不用。

![](https://www.yysuni.com/blogs/readme/2be290016e56cd34.png)

点击创建，谁能安装这个仓库这个选择无所谓。直接创建。

![](https://www.yysuni.com/blogs/readme/aa002e6805ab2d65.png)


### 创建密钥

创建好 Github App 后会提示必须创建一个 **Private Key**，直接创建，会自动下载（不见了也不要紧，后面自己再创建再下载就行）。页面上有个 **App ID** 需要复制一下

再切换到安装页面

![](https://www.yysuni.com/blogs/readme/c122b1585bb7a46a.png)

这里一定要只**授权当前项目**。

![](https://www.yysuni.com/blogs/readme/2cf1cee3b04326f1.png)

点击安装，就完成了 Github App 管理该仓库的权限设置了。下一步就是让前端知道推送那个项目，就是最开始提到的环境变量。（如果你不会设置环境变量，直接改仓库文件 `src/consts.ts` 也行。因为是公开的，所以环境变量意义也不大）

直接输入这几个环境变量值就行，一般只用设置 OWNER 和 APP_ID。其它配置不用管，直接输入创建就行。

![](https://www.yysuni.com/blogs/readme/c5a049d737848abf.png)

设置完成后，需要手动再部署一次，让环境变量生效。
* 可以直接 push 一次仓库代码会触发部署
* 也可以手动选择创建一次部署
![](https://www.yysuni.com/blogs/readme/59a802ed8d1c3a13.png)

## 4. 完成

现在，部署的这个网站就可以开始使用前端改内容了。比如更改一个分享内容。

**提示**，网站前端页面删改完提示成功之后，你需要等待后台的部署完成，再刷新页面才能完成服务器内容的更新哦。

## 5. 删除

使用这个项目应该第一件事需要删除我的 blog，单独删除，批量删除已完成。

## 6. 配置

大部分页面右上角都会有一个编辑按钮，意味着你可以使用 **private key** 进行配置部署。

### 6.1 网站配置

首页有一个不显眼的配置按钮，点击就能看到现在可以配置的内容。

![](https://www.yysuni.com/blogs/readme/cddb4710e08a5069.png)

## 7. 写 blog

写 blog 的图片管理，可能会有疑惑。图片管理推荐逻辑是先点击 **+ 号** 添加图片，（推荐先压缩好，尺寸推荐宽度不超过 1200）。然后将上传好的图片直接拖入文案编辑区，这就已经添加好了，点击右上角预览就可以看到效果。

## 8. 写给非前端

非前端配置内容，还是需要一个文件指引。下面写一些更细致的代码配置。

### 8.1 移除 Liquid Grass

进入 `src/layout/index.tsx` 文件，删除两行代码，然后提交代码到你的 github
```tsx
const LiquidGrass = dynamic(() => import('@/components/liquid-grass'), { ssr: false })
// 中间省略...
<LiquidGrass /> // 第 53 行
```

![](https://www.yysuni.com/blogs/readme/f70ff3fe3a77f193.png)

### 8.2 配置首页内容

首页的内容现在只能前端配置一部分，所以代码更改在 `src/app/(home)` 目录，这个目录代表首页所有文件。首页的具体文件为  `src/app/(home)/page.tsx`

 ![](https://www.yysuni.com/blogs/readme/011679cd9bf73602.png)

这里可以看到有很多 `Card` 文件，需要改那个首页 Card 内容就可以点入那个具体文件修改。

比如中间的内容，为 `HiCard`，点击 `hi-card.tsx` 文件，即可更改其内容。

![](https://www.yysuni.com/blogs/readme/20b0791d012163ee.png)

## 9. 互助群

对于完全不是**程序员**的用户，确实会对于更新代码后，如何同步，如何**合并代码**手足无措。我创建了一个 **QQ群**（加群会简单点），或者 vx 群还是 tg 群会好一点可以 issue 里面说下就行。

QQ 群：[https://qm.qq.com/q/spdpenr4k2](https://qm.qq.com/q/spdpenr4k2)
> 不好意思，之前的那个qq群ID（1021438316），不知道为啥搜不到😂

微信群：刚建好了一个微信群，没有 qq 的可以用这个微信群
![](https://www.yysuni.com/blogs/readme/343f2c62035b8e23.webp)

tg 群：1月1号，才创建的 tg 群 https://t.me/public_blog_2025


应该主要是我自己亲自帮助你们遇到问题怎么办。（后续看看有没有好心人）

希望多多的非程序员加入 blogger 行列，web blog 还是很好玩的，属于自己的 blog 世界。

游戏资产不一定属于你的，你只有**使用权**，但这个 blog **网站、内容、仓库一定是属于你的**

#### 特殊的导航 Card

因为这个 Card 是全局都在的，所以放在了 `src/components` 目录

![](https://www.yysuni.com/blogs/readme/9780c38f886322fd.png)

## Star History

<a href="https://www.star-history.com/#YYsuni/2025-blog-public&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=YYsuni/2025-blog-public&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=YYsuni/2025-blog-public&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=YYsuni/2025-blog-public&type=date&legend=top-left" />
 </picture>
</a>
