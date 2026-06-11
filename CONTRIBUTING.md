# Contributing

Thanks for your interest in KnowFlow.

KnowFlow is still early. The most useful contributions are small, focused changes that improve local reliability, source adapters, installation, security, and documentation.

## Development Setup

Requirements:

- Node.js 20 or newer
- pnpm 9 or newer

Install and run:

```bash
pnpm install
pnpm dev
```

Build before opening a pull request:

```bash
pnpm build
```

## Project Structure

- `apps/api` - Hono API server
- `apps/web` - React/Vite web app
- `packages/db` - SQLite/Drizzle schema and database access
- `packages/shared` - shared schemas and TypeScript types
- `packages/ai` - AI provider wrappers and prompts

## Guidelines

- Keep changes focused and easy to review.
- Do not commit local databases, logs, build output, or API keys.
- Keep API keys and private content out of test fixtures.
- Prefer cross-platform Node APIs over shell-specific commands.
- Use existing package boundaries before adding new abstractions.
- Run `pnpm build` before submitting changes.

## Security-Sensitive Areas

Please be especially careful with:

- HTML rendering in the reader
- API key storage and masking
- podcast audio download/transcription flows
- third-party upload fallbacks
- CORS and deployment settings

If you find a vulnerability, please follow `SECURITY.md` instead of opening a public issue.
