# Installation

This guide covers local installation on macOS, Linux, and Windows.

## Requirements

- Node.js 20 LTS or newer
- pnpm 9 or newer
- ffmpeg for podcast transcription compression

Enable pnpm with Corepack:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## macOS

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173.

If the default web port is already in use:

```bash
WEB_PORT=5180 pnpm dev
```

For a built local run, use:

```bash
pnpm build
pnpm start
```

## Linux

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173.

If native dependency installation fails, install common build tools:

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
```

For podcast transcription compression, install ffmpeg:

```bash
sudo apt-get install -y ffmpeg
```

## Windows

Use PowerShell.

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
pnpm dev
```

Open http://localhost:5173.

If `better-sqlite3` cannot install from a prebuilt binary, install Visual Studio Build Tools with the C++ build tools workload, then rerun `pnpm install`.

For podcast transcription compression, install ffmpeg and make sure `ffmpeg.exe` is available on `PATH`, or set `FFMPEG_PATH`.

## Local Data Directory

By default, KnowFlow stores data in a platform-specific user data directory:

- Windows: `%APPDATA%\KnowFlow`
- macOS: `~/Library/Application Support/KnowFlow`
- Linux: `~/.local/share/knowflow`

If an existing project-local database is found at `data/knowflow.db`, KnowFlow keeps using that directory for compatibility with earlier development builds.

Override this with:

```bash
KNOWFLOW_DATA_DIR=/path/to/data pnpm dev
```

## Runtime URL

Open http://localhost:5173.

The API server runs locally behind the web app and binds to `127.0.0.1:3001` by default. You normally do not need to open it directly unless you are developing or debugging the API.

If either default port is already in use:

```bash
PORT=3011 WEB_PORT=5180 pnpm dev
```

Then open http://localhost:5180.

## Optional Environment Variables

See `.env.example` for:

- `PORT`
- `HOST`
- `WEB_PORT`
- `KNOWFLOW_API_URL`
- `FFMPEG_PATH`
- `KNOWFLOW_CORS_ORIGINS`
- `KNOWFLOW_DATA_DIR`
- `KNOWFLOW_DEBUG`
- `KNOWFLOW_ALLOW_PUBLIC_TRANSCRIPTION_UPLOADS`
