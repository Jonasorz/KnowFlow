# Changelog

All notable changes to KnowFlow will be documented in this file.

This project follows Semantic Versioning where practical:

- `MAJOR` for incompatible changes or data migrations that require manual action
- `MINOR` for new user-facing features
- `PATCH` for bug fixes and documentation-only release notes

## Unreleased

### Changed

- Docker Compose now uses the prebuilt `ghcr.io/jonasorz/knowflow:latest` image by default, with `docker-compose.build.yml` reserved for local image builds.
- Docker Compose web port can be changed with `WEB_PORT`, for example `WEB_PORT=5180 docker compose up -d`.

## 0.1.0 - 2026-06-11

Initial public release.

### Added

- Docker Compose support for one-command local startup with persistent SQLite data under `./data`.
- Open-source readiness documentation, including installation, security, third-party services, and contribution guidelines.
- Cross-platform local start workflow with configurable `PORT` and `WEB_PORT`.
- Dependency license checking scripts.

### Changed

- The web app is documented as the primary local entrypoint.
- Existing project-local databases are preserved for compatibility with earlier development builds.
- Podcast source documentation now distinguishes Apple iTunes Search API, RSS feeds, and publisher/player links.

### Security

- External article/transcript HTML rendering is sanitized with DOMPurify.
- Debug logs are disabled by default.
- Temporary public transcription upload fallbacks are disabled by default.

### Included

- WeChat official account subscriptions through user-configured Dajiala API.
- X/Twitter subscriptions through user-configured twitterapi.io API.
- Podcast discovery through Apple iTunes Search API and RSS feeds.
- Local podcast playback.
- AI summaries, Q&A, and mind maps through user-configured AI providers.
- Optional podcast transcription through user-configured transcription providers.
