# Installation

This guide covers local installation on macOS, Linux, and Windows.

## Requirements

- Node.js 20 LTS or newer
- pnpm 9 or newer

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

## Local Data Directory

By default, KnowFlow stores data in a platform-specific user data directory:

- Windows: `%APPDATA%\KnowFlow`
- macOS: `~/Library/Application Support/KnowFlow`
- Linux: `~/.local/share/knowflow`

Override this with:

```bash
KNOWFLOW_DATA_DIR=/path/to/data pnpm dev
```

## Runtime URL

Open http://localhost:5173.

The API server runs locally behind the web app and listens on `http://localhost:3001` by default. You normally do not need to open it directly unless you are developing or debugging the API.

## Optional Environment Variables

See `.env.example` for:

- `PORT`
- `KNOWFLOW_CORS_ORIGINS`
- `KNOWFLOW_DATA_DIR`
- `KNOWFLOW_DEBUG`
- `KNOWFLOW_ALLOW_PUBLIC_TRANSCRIPTION_UPLOADS`
