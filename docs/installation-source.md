# Installation (From Source)

This runs Kenzo from source while keeping the underlying package names as `@flux/*`. The public CLI command is `kenzoboard`; `flux` remains available for compatibility.

## Prerequisites

- [Bun](https://bun.sh/) 1.1+

## Setup

```bash
bun install
bun run build
```

## Running

```bash
bun --filter @flux/server start
```

Visit http://localhost:3000 to open Kenzo.

## Development Mode

```bash
# Terminal 1: API server with hot reload
bun --filter @flux/server dev

# Terminal 2: Web dev server with HMR
bun --filter @flux/web dev
```

Kenzo's web UI will be at http://localhost:5173. The API runs on :3000 by default.

## CLI

The Kenzo CLI (`kenzoboard`) provides full task management from the terminal, powered by the Flux engine.

```bash
# Install from npm (recommended)
npx kenzoboard
npm install -g kenzoboard

# Or build and link from source
cd packages/cli && bun run build && bun link

# Or run directly
bun packages/cli/src/index.ts help
```

See [cli.md](./cli.md) for full CLI documentation.

## MCP with Local Install

Add to Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "flux": {
      "command": "bun",
      "args": ["/path/to/flux/packages/mcp/dist/index.js"]
    }
  }
}
```

For Claude Code:

```bash
# Claude Code
claude mcp add flux -- bun /path/to/flux/packages/mcp/dist/index.js

# Codex
codex mcp add flux -- bun /path/to/flux/packages/mcp/dist/index.js
```

For ChatGPT setup and best practices, see `docs/assistant-setup.md`.
