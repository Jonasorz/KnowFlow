# KnowFlow

[English](https://github.com/Jonasorz/KnowFlow/blob/main/README.md)

KnowFlow 是一个本地优先的多源阅读与知识工作流应用。

它把文章、推文、播客单集、转录文本和 AI 生成的笔记聚合到一个浏览器里的本地阅读器中。当前版本以本地 Web 界面运行，后端是 Node.js API，数据存储在 SQLite 中。

## 功能

- 通过 Dajiala API 订阅微信公众号文章
- 通过 twitterapi.io 订阅 X/Twitter 用户
- 通过 Apple iTunes Search API 发现播客，并从播客 RSS 获取单集元数据和音频链接
- 本地播放播客音频
- 通过 DashScope 或 OpenAI-compatible Whisper API 转录播客
- 通过 DeepSeek、Moonshot 或 OpenRouter 生成摘要、问答和思维导图
- 可选 Tavily 网页搜索上下文，用于问答
- 本地 SQLite 存储

YouTube、Bilibili 等视频源在计划中，当前还没有实现。

## 技术栈

- pnpm workspace
- TypeScript
- React + Vite
- Hono API server
- SQLite + Drizzle ORM
- Vercel AI SDK
- Zustand + TanStack Query

## 快速开始

推荐使用 Docker Compose。这样不需要在本机安装 Node.js、pnpm、编译工具或 ffmpeg。

Docker 安装只需要：

- Docker Desktop 或 Docker Engine
- Docker Compose

### 方式一：clone 仓库后启动

推荐这种方式，因为仓库里已经包含 `docker-compose.yml`、文档和后续更新所需文件。Compose 会自动拉取预构建镜像。

```bash
git clone https://github.com/Jonasorz/KnowFlow.git
cd KnowFlow
docker compose up -d
```

然后打开 http://localhost:5173。

Docker Compose 默认使用公开镜像：

```bash
ghcr.io/jonasorz/knowflow:latest
```

你不需要提前执行 `docker pull`。如果只是想预先下载或验证镜像，可以手动执行：

```bash
docker pull ghcr.io/jonasorz/knowflow:latest
```

注意：`docker pull` 只会下载镜像，不会启动应用。启动应用仍然使用：

```bash
docker compose up -d
```

### 方式二：只下载 Compose 文件

如果不想下载完整源代码，可以新建一个空目录，只下载 `docker-compose.yml`：

```bash
mkdir knowflow
cd knowflow
curl -L -o docker-compose.yml https://raw.githubusercontent.com/Jonasorz/KnowFlow/main/docker-compose.yml
docker compose up -d
```

然后打开 http://localhost:5173。

### 修改端口

如果 `5173` 端口已被占用：

```bash
WEB_PORT=5180 docker compose up -d
```

然后打开 http://localhost:5180。

Windows PowerShell:

```powershell
$env:WEB_PORT=5180
docker compose up -d
```

Docker Compose 默认把本地 SQLite 数据保存在当前目录的 `./data` 下。

完整安装说明见 [安装文档](https://github.com/Jonasorz/KnowFlow/blob/main/docs/installation.md)。

## 源码开发

本地源码开发需要：

- Node.js 20 或更新版本
- pnpm 9 或更新版本
- 播客转录压缩需要 `ffmpeg` 在 `PATH` 中可用，或通过 `FFMPEG_PATH` 配置

启动开发环境：

```bash
pnpm install
pnpm dev
```

然后打开 http://localhost:5173。

本地 API server 在 Web app 后面运行。开发环境中，Vite dev server 会把 `/api` 请求代理到本地 API server。

默认端口：

- Web app: `5173`
- 本地 API: `3001`

如果端口冲突，可以使用 `WEB_PORT` 和 `PORT` 修改。

构建后本地运行：

```bash
pnpm build
pnpm start
```

如果想在本机从源码构建 Docker 镜像，而不是使用预构建 GHCR 镜像：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

## 配置

大部分用户配置都在应用里的 Settings 页面完成。

也可以复制 `.env.example` 到 `.env`，用于服务端级别配置：

```bash
cp .env.example .env
```

常见 API key：

- Dajiala API key，用于微信公众号文章
- twitterapi.io API key，用于 X/Twitter
- DeepSeek API key
- Moonshot API key
- OpenRouter API key
- DashScope API key，用于转录
- Tavily API key，用于可选网页搜索

## 第三方服务

KnowFlow 会和用户自己配置的第三方服务集成，包括 Dajiala、twitterapi.io、Apple iTunes Search API、播客 RSS、DeepSeek、Moonshot、OpenRouter、DashScope 和 Tavily。

用户需要自行获取 API key，并遵守各服务提供商的条款。项目中提到这些服务不代表背书、赞助或官方合作关系。

详见 [第三方服务说明](https://github.com/Jonasorz/KnowFlow/blob/main/docs/third-party-services.md)。

## 数据存储

KnowFlow 使用 SQLite 存储本地数据。Settings 页面保存的 API key 也会存储在本地数据库中。

不要提交或分享本地数据目录中的文件。仓库已经忽略 SQLite 数据库、WAL/SHM 文件、日志和 TypeScript 构建元数据。

## 隐私与安全

KnowFlow 默认用于本地运行。

需要了解的重要行为：

- AI 摘要、问答和思维导图会把文章或转录内容发送给你配置的模型服务商。
- 播客转录可能会把音频下载到本地，并发送给你配置的转录服务商。
- 播客内容仍归创作者或发布方所有。KnowFlow 用于个人本地聚合和播放，不用于重新分发音频、转录文本或完整 shownotes。
- 当前项目不包含用户账号、访问控制或生产环境加固。
- 不要在没有认证、更严格 CORS、限流和部署加固的情况下，把 API server 直接暴露到公网。

当前安全策略见 [SECURITY.md](https://github.com/Jonasorz/KnowFlow/blob/main/SECURITY.md)。

## 贡献

开发设置和贡献说明见 [CONTRIBUTING.md](https://github.com/Jonasorz/KnowFlow/blob/main/CONTRIBUTING.md)。

发布和打 tag 说明见 [release guidance](https://github.com/Jonasorz/KnowFlow/blob/main/docs/release.md)。

## 常用脚本

```bash
pnpm dev       # 通过 Turbo 运行所有开发服务
pnpm build     # 构建所有 packages/apps
pnpm start     # 运行构建后的 web preview 和本地 API server
pnpm lint      # Turbo lint 占位任务
pnpm licenses:check
pnpm licenses:report
pnpm db:generate
pnpm db:migrate
```

本地 API server 默认绑定到 `127.0.0.1:3001`。Web 端口和 API 端口可通过 `WEB_PORT` 和 `PORT` 配置。除非你在开发或调试 API，通常不需要直接打开 API。

## 仓库卫生

发布或提交 PR 前，确认这些文件没有被跟踪：

- `*.db`
- `*.db-wal`
- `*.db-shm`
- `*.tsbuildinfo`
- `*.log`
- `dist/`
- `.turbo/`

## 许可证

MIT
