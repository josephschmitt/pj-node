---
name: pj-sync
description: "Integrate new pj CLI releases into the pj-node TypeScript wrapper. Use when a new version of the pj CLI has been released and the user wants to add support for new flags, JSON output fields, or other features. Triggers: new pj release, pj update, sync pj, new pj version, or when the user mentions a new pj CLI feature that needs TypeScript API support."
---

# pj CLI Sync Workflow

Integrate new pj CLI features into the pj-node TypeScript wrapper when a new version is released.

## Workflow

### 1. Find and check out the sync branch

```bash
git fetch origin
git branch -r | grep sync-pj
```

Check out the latest sync branch (e.g., `git checkout sync-pj-1.13`). These branches are auto-created by CI and already contain version bumps to `PJ_TARGET_VERSION` and `package.json`.

### 2. Review what's new in the pj release

```bash
gh release view vX.Y.0 --repo josephschmitt/pj
```

Check the linked PRs for implementation details:

```bash
gh pr view <number> --repo josephschmitt/pj --json body --jq '.body'
```

### 3. Ask the user about new features

Clarify the behavior of each new feature before implementing. Ask about:
- What the feature does and its output format
- Whether new JSON fields are conditional on specific flags

### 4. Implement changes

Two categories of changes, applied as needed:

#### New CLI flag (e.g., `--sort`, `--shorten`)

1. **`src/api/types.ts`** - Add option to `DiscoverOptions` interface
   - Boolean flags: `flagName?: boolean`
   - Value flags with fixed options: `flagName?: "option1" | "option2"`
   - Value flags with free text: `flagName?: string`

2. **`src/cli/executor.ts`** - Add to `buildArgs()` function
   - Boolean: `if (options?.flagName) { args.push("--flag-name"); }`
   - Value: `if (options?.flagName) { args.push("--flag-name", options.flagName); }`

3. **`test/unit/executor.test.ts`** - Add `buildArgs` test(s)
   ```typescript
   it("should add --flag-name flag when set", () => {
     const args = buildArgs({ flagName: true });
     expect(args).toContain("--flag-name");
   });
   ```

#### New JSON output field (e.g., `displayPath`, `ansiIcon`)

1. **`src/api/types.ts`** - Add field to `Project` interface
   - Fields are `string | undefined` (not optional `?`) since they may be absent from JSON

2. **`src/cli/executor.ts`** - Add to `PjJsonProject` interface (as optional `?`) and map in `parseJsonOutput`

3. **`test/unit/executor.test.ts`** - Add `fieldName: undefined` to ALL existing `toEqual` expectations, plus a new test case with the field populated

### 5. Verify

```bash
npm run type-check && npm test && npm run lint
```

### 6. Commit, push, and update the PR

Commit with `feat:` prefix (this is a pj CLI version update). Check if a PR already exists on the branch and update it rather than creating a new one:

```bash
gh pr list --head sync-pj-X.Y --json number,title,state --jq '.[0]'
```

## TypeScript strictness reminders

- `exactOptionalPropertyTypes: true` - On `Project`, use `field: string | undefined` (not `field?: string`) for fields that are always present in the mapped output but may lack a value
- `noUncheckedIndexedAccess: true` - Array/object index access returns `T | undefined`
