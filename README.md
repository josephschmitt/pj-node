# @joe-sh/pj

TypeScript API and binary installer for [pj](https://github.com/josephschmitt/pj) - a fast project finder.

## Features

- **Dual-purpose package**: Works as both a global CLI tool and a TypeScript library
- **Automatic binary management**: Downloads and manages the pj binary automatically
- **Smart binary resolution**: Prefers globally installed pj, falls back to managed binary
- **Full TypeScript support**: Complete type definitions for all APIs
- **Cross-platform**: Works on macOS, Linux, and Windows

## Installation

### As a global CLI tool

```bash
npm install -g @joe-sh/pj
```

Then use `pj` directly:

```bash
pj --icons
```

### As a library

```bash
npm install @joe-sh/pj
```

## Usage

### Library API

```typescript
import { Pj, discover } from '@joe-sh/pj';

// Using the class-based API
const pj = new Pj();
const projects = await pj.discover();
console.log(projects);

// Using standalone functions
const allProjects = await discover();

// Find a specific project
const myProject = await pj.findProject('my-app');

// Search for projects by pattern
const reactProjects = await pj.findProjects(/react/i);

// Get projects grouped by marker type
const byMarker = await pj.discoverByMarker();
console.log(byMarker.get('package.json')); // All Node.js projects
```

### Discovery Options

```typescript
const projects = await pj.discover({
  // Search paths
  paths: ['~/projects', '~/code'],

  // Project markers to detect
  markers: ['.git', 'package.json', 'go.mod'],

  // Patterns to exclude
  excludes: ['node_modules', 'vendor'],

  // Maximum search depth
  maxDepth: 3,

  // Include icons in output
  icons: true,

  // Bypass cache
  noCache: true,
});
```

### Configuration Management

```typescript
import { Pj, loadConfig, saveConfig } from '@joe-sh/pj';

// Load existing configuration
const config = await loadConfig();

// Create instance with custom config
const pj = new Pj({
  paths: ['~/my-projects'],
  maxDepth: 5,
});

// Save configuration
await pj.saveConfig();
```

### Binary Management

```typescript
import { Pj, getBinaryManager } from '@joe-sh/pj';

const pj = new Pj();

// Check binary status
const status = await pj.getBinaryStatus();
console.log(status);
// { available: true, path: '/usr/local/bin/pj', version: '1.4.1', source: 'global' }

// Ensure binary is available (downloads if needed)
const binaryPath = await pj.ensureBinary();

// Update to latest version
await pj.updateBinary();

// Get version
const version = await pj.getBinaryVersion();
```

### Cache Management

```typescript
const pj = new Pj();

// Clear the project cache
await pj.clearCache();

// Get cache info
const info = await pj.getCacheInfo();
console.log(info);
// { exists: true, path: '~/.cache/pj', fileCount: 3, totalSize: 4096 }
```

## API Reference

### Pj Class

The main class for interacting with pj.

#### Constructor

```typescript
new Pj(config?: Partial<PjConfig>)
```

#### Methods

| Method | Description |
|--------|-------------|
| `discover(options?)` | Discover all projects |
| `discoverFromPaths(paths, options?)` | Discover projects from specific paths |
| `findProject(name, options?)` | Find a project by name |
| `findProjects(pattern, options?)` | Find projects matching a pattern |
| `discoverByMarker(options?)` | Get projects grouped by marker type |
| `countByMarker(options?)` | Count projects by marker type |
| `clearCache()` | Clear the pj project cache |
| `getCacheInfo()` | Get information about the pj cache |
| `loadConfig(path?)` | Load configuration from file |
| `saveConfig(config?, path?)` | Save configuration to file |
| `getConfig()` | Get current configuration |
| `setConfig(config)` | Update configuration |
| `ensureBinary(options?)` | Ensure the pj binary is available |
| `getBinaryStatus()` | Get the status of the pj binary |
| `updateBinary(options?)` | Update the pj binary |
| `getBinaryVersion()` | Get the version of the pj binary |

### Standalone Functions

| Function | Description |
|----------|-------------|
| `discover(options?)` | Discover all projects |
| `discoverFromPaths(paths, options?)` | Discover from specific paths |
| `findProject(name, options?)` | Find a project by name |
| `findProjects(pattern, options?)` | Find projects by pattern |
| `discoverByMarker(options?)` | Group projects by marker |
| `countByMarker(options?)` | Count projects by marker |
| `loadConfig(path?)` | Load configuration |
| `saveConfig(config, path?)` | Save configuration |
| `clearCache()` | Clear the project cache |
| `getCacheInfo()` | Get cache information |
| `getBinaryManager()` | Get the binary manager instance |

### Types

```typescript
interface Project {
  path: string;      // Absolute path to the project
  name: string;      // Project name (directory name)
  marker: string;    // Marker that identified this project
  icon?: string;     // Optional Nerd Font icon
  priority?: number; // Marker priority
}

interface DiscoverOptions {
  paths?: string[];
  markers?: string[];
  excludes?: string[];
  maxDepth?: number;
  noIgnore?: boolean;
  nested?: boolean;
  noCache?: boolean;
  icons?: boolean;
  configPath?: string;
  verbose?: boolean;
}

interface PjConfig {
  paths: string[];
  markers: string[];
  exclude: string[];
  maxDepth: number;
  cacheTTL: number;
  noIgnore: boolean;
  noNested: boolean;
  icons: Record<string, string>;
}

interface BinaryStatus {
  available: boolean;
  path: string | null;
  version: string | null;
  source: 'global' | 'cache' | 'env' | null;
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PJ_BINARY_PATH` | Override the pj binary path |
| `PJ_SKIP_INSTALL` | Skip binary download during npm install |
| `PJ_INSTALL_BINARY` | Force binary download in CI environments |

## Version Compatibility

This package tracks the [pj CLI](https://github.com/josephschmitt/pj) version using a **major.minor pinning** strategy:

| This package | Compatible pj versions |
|--------------|------------------------|
| `1.4.x`      | `1.4.0`, `1.4.1`, `1.4.2`, ... |
| `1.5.x`      | `1.5.0`, `1.5.1`, `1.5.2`, ... |

**How it works:**

- This package stays in sync with pj's major.minor version
- Patch versions (the third number) are independent — patches to this package are for TypeScript wrapper bug fixes, not pj CLI changes
- When you install or update, the package automatically downloads the **latest compatible pj patch** within your major.minor range

**What this means for you:**

- `@joe-sh/pj@1.4.2` will install the latest `pj 1.4.x` (e.g., `1.4.5` if available)
- When pj `1.5.0` is released, upgrade to `@joe-sh/pj@1.5.x` to get the new features

## Binary Resolution Order

The package looks for the pj binary in this order:

1. `PJ_BINARY_PATH` environment variable
2. Globally installed `pj` in PATH (if version-compatible)
3. Cached binary in `~/.cache/pj-node/` (if version-compatible)
4. Downloads from GitHub releases (highest compatible version)

## Requirements

- Node.js 20.0.0 or higher

## Related Projects

- [pj](https://github.com/josephschmitt/pj) - The pj CLI tool
- [pj.nvim](https://github.com/josephschmitt/pj.nvim) - Neovim integration

## License

MIT
