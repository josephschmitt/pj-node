# pj Release Integration

This document describes how to set up automatic version syncing between pj and pj-node.

## Overview

When a new pj version is released, pj-node should be notified so it can create a PR to update its version if needed. This is done via GitHub's repository dispatch feature.

## Setup Instructions

### 1. Create a Personal Access Token (PAT)

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it `PJ_NODE_DISPATCH` or similar
4. Select the `repo` scope (needed to trigger workflows in pj-node)
5. Generate and copy the token

### 2. Add the secret to pj repository

1. Go to https://github.com/josephschmitt/pj/settings/secrets/actions
2. Click "New repository secret"
3. Name: `PJ_NODE_PAT`
4. Value: paste the PAT from step 1
5. Click "Add secret"

### 3. Update pj's release workflow

Add the following step to `.github/workflows/release.yml` in the pj repository, after the GoReleaser step:

```yaml
      - name: Notify pj-node of new release
        if: success()
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.PJ_NODE_PAT }}
          repository: josephschmitt/pj-node
          event-type: pj-release
          client-payload: '{"version": "${{ github.ref_name }}"}'
```

The full workflow should look like:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  goreleaser:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Fetch tags
        run: git fetch --tags --force

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.23"

      - name: Run GoReleaser
        uses: goreleaser/goreleaser-action@v6
        with:
          version: "~> v2"
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          HOMEBREW_TAP_GITHUB_TOKEN: ${{ secrets.HOMEBREW_TAP_GITHUB_TOKEN }}
          SCOOP_BUCKET_GITHUB_TOKEN: ${{ secrets.SCOOP_BUCKET_GITHUB_TOKEN }}

      - name: Notify pj-node of new release
        if: success()
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.PJ_NODE_PAT }}
          repository: josephschmitt/pj-node
          event-type: pj-release
          client-payload: '{"version": "${{ github.ref_name }}"}'
```

## How it works

### pj-sync flow (new pj release)

1. pj releases a new version (tag pushed matching `v*`), GoReleaser runs
2. After successful release, the workflow dispatches an event to pj-node
3. pj-node's `sync-pj-version.yml` receives the event
4. It compares the new version's major.minor against `PJ_TARGET_VERSION`
5. If they differ, it creates a PR with the version updates
6. CI runs on the PR → if tests pass → auto-merge
7. Publish workflow detects version change → publishes to npm + creates GitHub Release

### Fix/feature flow (regular development)

1. Developer merges a PR to main (code changes only, no version bump)
2. `release.yml` workflow creates a release PR that bumps the patch version
3. CI runs on the release PR → if tests pass → auto-merge
4. Publish workflow detects version change → publishes to npm + creates GitHub Release

## What gets updated

When a new major or minor pj version is detected (e.g., pj goes from 1.4.x to 1.5.0 or 2.0.0):

- `src/binary/constants.ts`: `PJ_TARGET_VERSION` is updated to the new major.minor
- `package.json`: version is updated to `{major}.{minor}.0`

Patch releases (e.g., pj 1.4.1 → 1.4.2) don't require pj-node changes since the version range is already compatible.

## Required repository settings

For auto-merge to work:

1. **Enable auto-merge**: Settings → General → Pull Requests → Allow auto-merge ✓
2. **Branch protection for `main`**: Settings → Branches → Add rule
   - Require status checks to pass: `test`
3. **NPM_TOKEN secret**: Settings → Secrets → Actions → Add `NPM_TOKEN`
   - Generate at npmjs.com → Access Tokens → Automation token
