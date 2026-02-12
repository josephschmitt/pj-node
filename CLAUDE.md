# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Build with tsup (outputs to dist/)
npm run build:watch    # Build in watch mode
npm test               # Run all tests with vitest
npm run test:watch     # Run tests in watch mode
vitest run test/unit/config.test.ts  # Run a single test file
npm run lint           # Lint src/ with eslint
npm run lint:fix       # Lint and auto-fix
npm run type-check     # TypeScript type checking (tsc --noEmit)
```

## Architecture

This package is a TypeScript wrapper around the [pj CLI](https://github.com/josephschmitt/pj) - a fast project finder written in Go. It provides:

1. **Binary Management** (`src/binary/`) - Downloads, caches, and manages the pj binary
2. **TypeScript API** (`src/api/`) - High-level API for project discovery
3. **CLI Execution** (`src/cli/`) - Runs the pj binary and parses output

### Key Components

- **`BinaryManager`** (`src/binary/manager.ts`) - Handles binary resolution: checks global install → cached binary → downloads from GitHub releases. Respects version compatibility with `PJ_TARGET_VERSION`.

- **`Pj` class** (`src/api/pj.ts`) - Main entry point. Wraps all functionality including discovery, config, cache, and binary management.

- **Version compatibility** (`src/binary/version.ts`, `constants.ts`) - Uses major.minor pinning. `PJ_TARGET_VERSION` (e.g., "1.5") determines which pj CLI versions are compatible.

### Version Strategy

This package tracks pj's major.minor version:
- pj-node `1.5.x` works with pj CLI `1.5.0`, `1.5.1`, `1.5.2`, etc.
- Patch versions are independent (for wrapper bug fixes)
- When pj releases `1.6.0`, pj-node must release `1.6.0`

## TypeScript Configuration

Uses strict TypeScript with extra strictness flags:
- `exactOptionalPropertyTypes: true` - Optional properties can't be `undefined` explicitly
- `noUncheckedIndexedAccess: true` - Array/object index access returns `T | undefined`

## Commit Convention

This repo uses conventional commits. Due to the version strategy (major.minor tracks pj CLI), only patch-level commits trigger automatic releases:

**Triggers release PR (patch bump):**
- `fix:` - Bug fixes
- `chore:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:` - Other patch-level changes

**Does NOT trigger release PR:**
- `feat:` - New features (minor version, reserved for pj CLI updates)
- `type!:` or `BREAKING CHANGE` - Breaking changes (major version, reserved for pj CLI updates)
- Any other prefix (e.g., `maint:`) - No automatic release

## CI/CD Automation

Fully automated publishing pipeline:
1. Patch-level commits merged → Release workflow creates version bump PR (auto-merges)
2. pj releases new version → Sync workflow creates version PR (requires manual review)
3. Publish workflow publishes to npm with OIDC provenance

### Sync Workflow for New pj Versions

When a new pj CLI version is released, CI automatically creates a `sync-pj-X.Y` branch and PR. To add support for new features:

1. **Check out the sync branch**: `git fetch origin && git checkout sync-pj-X.Y`
2. **Review pj release notes**: `gh release view vX.Y.0 --repo josephschmitt/pj`
3. **Update TypeScript API** for new features:
   - New CLI flags → Add to `DiscoverOptions` in `src/api/types.ts`, then update `buildArgs()` in `src/cli/executor.ts`, `discoverFromPaths()` in `src/api/discover.ts`, and `mergeOptions()` in `src/api/pj.ts`
   - New JSON output fields → Add to `Project` interface in `src/api/types.ts`, then update `PjJsonProject` and `parseJsonOutput()` in `src/cli/executor.ts`
4. **Add tests** in `test/unit/executor.test.ts`
5. **Run checks**: `npm test && npm run type-check && npm run lint`
6. **Commit and push**: Use `feat: support pj vX.Y.0 features` message
7. **Update PR description**: `gh pr edit <number> --body "..."` to list the API changes made

## Pre-push Hook

Husky runs lint, type-check, and tests before every push.
