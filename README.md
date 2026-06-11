# KnowFlow

KnowFlow is a local-first multi-source reading and knowledge workflow app.

It aggregates articles, tweets, podcast episodes, transcripts, and AI-generated notes into a browser-based reader. The current app runs as a local web interface with a Node.js API and SQLite database.

## Features

- WeChat official account article subscriptions via Dajiala API
- X/Twitter user subscriptions via twitterapi.io
- Podcast search via Apple iTunes Search API and RSS feeds
- Local podcast audio playback
- Podcast transcription through DashScope or OpenAI-compatible Whisper APIs
- AI summaries, Q&A, and mind maps through DeepSeek, Moonshot, or OpenRouter
- Optional Tavily web search context for Q&A
- Local SQLite storage

Video sources such as YouTube and Bilibili are planned but not implemented yet.

## Tech Stack

- pnpm workspace
- TypeScript
- React + Vite
- Hono API server
- SQLite + Drizzle ORM
- Vercel AI SDK
- Zustand + TanStack Query

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer
- ffmpeg, required only for podcast audio transcription compression

On Windows, if `better-sqlite3` cannot install from a prebuilt binary, install Visual Studio Build Tools and retry `pnpm install`.

## Getting Started

```bash
pnpm install
pnpm dev
```

Then open:

- Web app: http://localhost:5173
- API server: http://localhost:3001

The Vite dev server proxies `/api` requests to the local API server.

## Configuration

Most user-facing configuration is stored through the Settings page inside the app.

You may also copy `.env.example` to `.env` for server-level configuration:

```bash
cp .env.example .env
```

Common API keys configured in the app:

- Dajiala API key for WeChat article access
- twitterapi.io API key for X/Twitter access
- DeepSeek API key
- Moonshot API key
- OpenRouter API key
- DashScope API key for transcription
- Tavily API key for optional web search

## Data Storage

KnowFlow stores local data in SQLite. API keys saved in the Settings page are stored in that local database.

Do not commit or share files under local data directories. The repository ignores SQLite databases, WAL/SHM files, logs, and TypeScript build metadata.

## Privacy And Security

KnowFlow is intended for local use by default.

Important behavior to understand:

- AI summary, Q&A, and mind map features send article or transcript content to the model provider you configure.
- Podcast transcription may download audio locally and send audio to the transcription provider you configure.
- This project does not currently include user accounts, access control, or production hardening.
- Do not expose the API server directly to the public internet without adding authentication, stricter CORS settings, rate limits, and deployment hardening.

## Development Scripts

```bash
pnpm dev       # Run all dev servers through Turbo
pnpm build     # Build all packages/apps
pnpm lint      # Placeholder Turbo lint task
pnpm db:generate
pnpm db:migrate
```

## Repository Hygiene

Before publishing or opening a pull request, make sure these files are not tracked:

- `*.db`
- `*.db-wal`
- `*.db-shm`
- `*.tsbuildinfo`
- `*.log`
- `dist/`
- `.turbo/`

## License

MIT
