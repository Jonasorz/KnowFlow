# Release Process

This document describes how KnowFlow maintainers prepare tags and GitHub releases.

## Versioning

Use Semantic Versioning where practical:

- `MAJOR` for incompatible changes, data migrations requiring manual action, or significant deployment model changes
- `MINOR` for new features that remain backward-compatible
- `PATCH` for bug fixes, security fixes, and documentation corrections

Before `1.0.0`, minor versions may still include larger changes. Call out breaking changes clearly in release notes.

## Branches

- `main` should remain usable and buildable.
- Use short-lived feature branches for work in progress.
- Prefer Pull Requests for merging back to `main`, even for maintainer-authored changes.

Recommended branch names:

```bash
codex/add-source-adapter
codex/fix-transcription-error
codex/update-docs
```

## Pre-release Checklist

Before tagging a release:

1. Confirm the working tree is clean.
2. Run:

   ```bash
   pnpm install
   pnpm build
   pnpm licenses:check
   ```

3. Review `CHANGELOG.md` and move relevant `Unreleased` entries under the new version.
4. Check that no local data or secrets are tracked:

   ```bash
   git status --short
   git ls-files | grep -E '(\.env|\.db|\.db-wal|\.db-shm|\.log|\.tsbuildinfo)$'
   ```

5. Verify installation instructions still match the app behavior.

## Tagging

Create an annotated tag:

```bash
git tag -a v0.1.0 -m "KnowFlow v0.1.0"
git push origin v0.1.0
```

## GitHub Release Notes

Include:

- What changed
- Installation/update steps
- Required API keys or optional integrations
- Data storage notes
- Known limitations
- Any breaking changes or manual migration steps

For the first public release, call out:

- KnowFlow is local-first.
- Users bring their own third-party API keys.
- The API server is intended for local use and should not be exposed publicly without hardening.
- Podcast content and fetched platform content remain owned by creators, publishers, or platforms.
- Video sources are planned but not implemented.
