# Changelog

All notable changes to KnowFlow will be documented in this file.

This project follows Semantic Versioning where practical:

- `MAJOR` for incompatible changes or data migrations that require manual action
- `MINOR` for new user-facing features
- `PATCH` for bug fixes and documentation-only release notes

## Unreleased

## 0.1.4 - 2026-06-17

### Fixed

- Fixed tag-scoped source syncing so selecting a tag syncs only sources in that tag.
- Fixed tag source filtering so syncing after choosing a specific source within a tag syncs only that source.
- Improved X/Twitter search result normalization so subscriptions can be added from more twitterapi.io response shapes.

## 0.1.3 - 2026-06-13

### Added

- Added a Settings > About update checker that queries GitHub Releases and displays the latest release notes and link.
- Added a newspaper article view for editorial-style browsing.
- Added a summary article view and made it the default article list experience.

### Changed

- Replaced the card/grid article view with summary, newspaper, and list view options.
- Improved WeChat article card handling by hiding blocked WeChat cover images in list thumbnails.
- Expanded newspaper view article text density and aligned article view widths.

### Fixed

- Improved WeChat Biz ID extraction for current WeChat article HTML formats.
- Removed incorrect article count labels from the newspaper view.

## 0.1.2 - 2026-06-13

### Added

- Added a Simplified Chinese README with installation, Docker, configuration, and security notes.

### Changed

- Clarified Docker Compose installation steps, including repository clone, Compose-only setup, optional image pull, and custom web ports.
- Updated README documentation references to use full GitHub links.

## 0.1.1 - 2026-06-12

### Changed

- Docker Compose now uses the prebuilt `ghcr.io/jonasorz/knowflow:latest` image by default, with `docker-compose.build.yml` reserved for local image builds.
- Published Docker images now target both `linux/amd64` and `linux/arm64`.
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
