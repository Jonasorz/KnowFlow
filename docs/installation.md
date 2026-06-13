# Installation

This guide covers Docker Compose and local installation on macOS, Linux, and Windows.

## Docker Compose

Docker Compose is the easiest way to run KnowFlow without installing Node.js, pnpm, build tools, or ffmpeg on your host machine.

### Option A: Clone the repository

This is the recommended path because it gives you the Compose file, docs, and update scripts in one place. Docker Compose will pull the prebuilt GHCR image automatically.

```bash
git clone https://github.com/Jonasorz/KnowFlow.git
cd KnowFlow
docker compose up -d && printf "\nKnowFlow is ready: http://localhost:5173\n"
```

Then open the printed local URL.

### Option B: Use only the Compose file

If you do not want the source code, create an empty folder and download only `docker-compose.yml`:

```bash
mkdir knowflow
cd knowflow
curl -L -o docker-compose.yml https://raw.githubusercontent.com/Jonasorz/KnowFlow/main/docker-compose.yml
docker compose up -d && printf "\nKnowFlow is ready: http://localhost:5173\n"
```

Then open the printed local URL.

On Windows, use PowerShell and `curl.exe`:

```powershell
mkdir knowflow
cd knowflow
curl.exe -L -o docker-compose.yml https://raw.githubusercontent.com/Jonasorz/KnowFlow/main/docker-compose.yml
docker compose up -d
Write-Host "`nKnowFlow is ready: http://localhost:5173"
```

Then open the printed local URL.

### Optional: Pull the image first

You do not need to run `docker pull` before `docker compose up -d`. Compose pulls the image automatically. A manual pull is only useful when you want to pre-download or verify the image:

```bash
docker pull ghcr.io/jonasorz/knowflow:latest
```

This only downloads the image. It does not start KnowFlow. Start the app with:

```bash
docker compose up -d && printf "\nKnowFlow is ready: http://localhost:5173\n"
```

### Change the web port

If port `5173` is already in use:

```bash
WEB_PORT=5180 docker compose up -d && printf "\nKnowFlow is ready: http://localhost:5180\n"
```

Then open http://localhost:5180.

On Windows PowerShell:

```powershell
$env:WEB_PORT=5180
docker compose up -d
Write-Host "`nKnowFlow is ready: http://localhost:5180"
```

Docker Compose stores local SQLite data in `./data`:

```text
data/knowflow.db
```

If you use Docker, keep the folder that contains `docker-compose.yml` and `./data`. This directory is the local data directory for the Docker deployment.

Stop the app with:

```bash
docker compose down
```

To run in the background:

```bash
docker compose up -d && printf "\nKnowFlow is ready: http://localhost:5173\n"
```

View logs with:

```bash
docker compose logs -f
```

### Upgrade Docker Deployment

KnowFlow stores Docker data in `./data`, so upgrading the container image does not delete your database as long as you keep that folder.

Before upgrading, stop the app and make a backup:

```bash
docker compose down
cp -R data data.backup
```

Then pull the latest image and start again:

```bash
docker compose pull
docker compose up -d && printf "\nKnowFlow is ready: http://localhost:5173\n"
```

Open the printed local URL after the containers start.

### Uninstall Docker Deployment

Stop and remove the containers:

```bash
docker compose down
```

This keeps `./data` by default. To fully remove KnowFlow data, delete the local project folder or remove `./data` after you have backed up anything you need.

To build the Docker image locally instead of using the prebuilt GHCR image:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

## Source Requirements

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
