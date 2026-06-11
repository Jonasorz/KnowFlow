# Security Policy

KnowFlow is designed for local-first personal use. It is not yet hardened as a public multi-user web service.

## Supported Versions

Security fixes currently target the `main` branch.

## Reporting A Vulnerability

Please do not disclose security issues in a public GitHub issue.

Open a private security advisory on GitHub if available, or contact the maintainer directly through the repository owner's preferred channel.

Include:

- affected version or commit
- steps to reproduce
- expected impact
- any relevant logs or screenshots with secrets removed

## Current Security Boundaries

- The API server is intended to run locally.
- API keys saved in Settings are stored in the local SQLite database.
- AI features send selected article/transcript content to the configured AI provider.
- Podcast transcription sends audio to the configured transcription provider.
- Temporary public transcription upload fallbacks are disabled by default.
- There is no built-in authentication or user account system.

Do not expose the API server directly to the public internet without adding authentication, rate limiting, stricter CORS, TLS, and deployment hardening.
