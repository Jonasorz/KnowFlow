# Third-party Services And Licenses

KnowFlow integrates with several third-party services. These integrations are optional or user-configured, and users are responsible for obtaining API keys and complying with each provider's terms.

Mentioning a service in this project does not imply endorsement, sponsorship, official partnership, or affiliation.

## Service Integrations

| Area | Service | Purpose |
| --- | --- | --- |
| WeChat articles | Dajiala API | Fetch WeChat official account article metadata/content when configured |
| X/Twitter | twitterapi.io | Search users and fetch tweets when configured |
| Podcast discovery | Apple iTunes Search API | Discover podcast RSS feed URLs |
| Podcasts | Publisher RSS feeds | Fetch episode metadata, shownotes, audio enclosure URLs, and original links |
| AI | DeepSeek, Moonshot, OpenRouter | User-configured model providers for summaries, Q&A, and mind maps |
| Transcription | DashScope or OpenAI-compatible Whisper APIs | User-configured podcast transcription |
| Web search | Tavily | Optional web search context for Q&A |

## User-owned Credentials

KnowFlow does not ship API keys. Users configure their own credentials in the local Settings page.

API keys saved in Settings are stored in the local SQLite database. Do not commit or share local database files.

## Content Rights

Podcast audio, show notes, transcripts, summaries, article content, tweets, images, and other fetched content remain owned by their creators, publishers, or platforms.

KnowFlow is intended for personal local aggregation, reading, playback, and note-taking. Do not use it to redistribute audio, transcripts, full show notes, articles, or other third-party content unless you have the necessary rights.

## Dependency Licenses

KnowFlow is licensed under MIT. Third-party npm dependencies retain their own licenses.

For source development, dependency metadata is recorded in `package.json` and `pnpm-lock.yaml`.

Podcast transcription compression uses an external `ffmpeg` executable from `PATH` or `FFMPEG_PATH`. KnowFlow does not bundle ffmpeg binaries.

Before publishing release artifacts such as Docker images, binary bundles, desktop installers, or hosted distributions, generate and review a third-party dependency license report:

```bash
pnpm licenses:check
pnpm licenses:report
```

`pnpm licenses:report` writes `THIRD_PARTY_LICENSES.json`. Review the output before shipping release artifacts.
