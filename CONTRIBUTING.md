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

## Branch And Pull Request Workflow

`main` should remain usable and buildable. Avoid committing experimental work directly to `main`.

For each change:

1. Create a short-lived branch:

   ```bash
   git checkout -b codex/short-description
   ```

2. Make focused changes.
3. Run:

   ```bash
   pnpm build
   ```

4. Open a Pull Request into `main`.
5. Keep the PR description clear about user-visible changes, data/storage changes, and any security or privacy implications.

Maintainers may merge small documentation-only changes directly, but feature work and behavior changes should go through a PR when possible.

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
- Update `CHANGELOG.md` when a change is user-visible.

## Security-Sensitive Areas

Please be especially careful with:

- HTML rendering in the reader
- API key storage and masking
- podcast audio download/transcription flows
- third-party upload fallbacks
- CORS and deployment settings

If you find a vulnerability, please follow `SECURITY.md` instead of opening a public issue.

## Releases

Release tags are created from `main` after verification. See `docs/release.md` for the release checklist, tag format, and GitHub release note guidance.
