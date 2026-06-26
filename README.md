# Kenzo &middot; powered by the Flux engine &middot; [![CI](https://github.com/drewsephski/kenzo/actions/workflows/ci.yml/badge.svg)](https://github.com/drewsephski/kenzo/actions/workflows/ci.yml) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat&logo=typescript&logoColor=white) ![Preact](https://img.shields.io/badge/Preact-673ab8?style=flat&logo=preact&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-enabled-f59e0b?style=flat)

> Kenzo is the local-first board for human-led AI work. Flux is the engine that powers the CLI, MCP, sync, storage, and APIs.

<p align="center">
  <img src="./docs/kibo-mascot.png" width="220" />
</p>

Kenzo gives teams and agents one visible operating layer for projects, epics, tasks, blockers, and handoffs. The Flux engine underneath keeps the system open and hackable: local-first storage, CLI control, MCP access, REST APIs, webhooks, and git-native sync.

Use the Kenzo web UI when you want a board humans can scan. Use `kenzoboard` for the primary CLI and local app experience. Advanced users can still use the compatible `flux` command when agents need a precise, scriptable engine interface. Internally, package names remain `@flux/*` for now.

![Demo](./docs/demo.gif)

## Why Kenzo?

Kenzo keeps execution visible without hiding the mechanics that make agent workflows reliable:

- **Shared control surface**: Humans use the web board; agents use MCP, REST, or the CLI against the same data.
- **Powered by the Flux engine**: Local JSON storage by default, optional engine-level SQLite/server modes, git-native sync, and transparent package internals.
- **Execution-ready context**: Priorities, dependencies, comments, blobs, and blockers stay attached to the work.

Kenzo is the product experience. Flux remains the engine-level compatibility name for existing data directories, package imports, environment variables, sync branches, and MCP resource identifiers.

<p align="center">
  <img src="./docs/sample-workflow.png" alt="Sample workflow" />
  <br />
  <em>Sample workflow</em>
</p>

## Features

- **Multi-Project Kanban Boards**: Organize epics, tasks, and dependencies across separate initiatives.
- **Task Dependencies**: See blocked work at a glance before humans or agents pick it up.
- **MCP Integration**: Let LLMs list, create, update, or delete tasks programmatically.
- **Real-Time Updates**: SSE keeps everyone in sync – web UI, APIs, and beyond.
- **Webhooks**: Integrate with Slack, GitHub, CI/CD, or custom automation on task changes.
- **API-First Design**: Full REST endpoints for custom frontends, automations, and integrations.
- **Git-Native Sync**: `flux push` / `flux pull` syncs via `flux-data` branch.
- **CLI-First**: Full CLI with MCP parity (`kenzoboard ready`, `kenzoboard task`, and compatible `flux` commands)
- **Agent Memory**: Task comments for persistent context across sessions
- **Priority System**: P0/P1/P2 priorities for agent task ordering
- **Blob Storage**: Attach files (images, docs, logs) to tasks via CLI, API, or MCP.

## Naming and Packages

Kenzo is the product name. Flux remains the engine and compatibility layer:

- npm CLI package: `kenzoboard`
- primary CLI command: `kenzoboard`
- compatibility CLI command: `flux`
- workspace packages: `@flux/*`
- local data directory: `.flux/`
- sync branch: `flux-data`
- MCP resources: `flux://...`

The public package is `kenzoboard`; the `flux` bin remains as a compatibility command for existing users and engine-level automation.

## Quick Start

```bash
# Local app + CLI
npx kenzoboard

# Explicit commands
npx kenzoboard init
npx kenzoboard dev
npx kenzoboard serve
npx kenzoboard ready
npx kenzoboard connect codex
npx kenzoboard mcp
```

`npx kenzoboard` creates or opens a local Kenzo workspace in `./.flux`, starts the bundled app, opens [http://localhost:3000](http://localhost:3000), and points you to the one-step Codex connector. If port 3000 is busy, Kenzo prints the selected fallback port.

To connect Codex to the same board:

```bash
npx kenzoboard connect codex
```

Manual MCP commands are still available:

```bash
# Claude Code
claude mcp add flux --env FLUX_DIR="$(pwd)/.flux" -- npx -y --package kenzoboard kenzoboard-mcp

# Codex
codex mcp add flux --env FLUX_DIR="$(pwd)/.flux" -- npx -y --package kenzoboard kenzoboard-mcp
```

MCP is the smooth path for agents because Codex can list projects, pick ready tasks, add notes, and mark work done without shelling out. Without MCP, an agent can still use the CLI (`kenzoboard ready`, `kenzoboard task start`, `kenzoboard task done`) as long as your `AGENTS.md` includes the workflow below.

Let your agent know!

```bash
cat << 'EOF' >> AGENTS.md
---
You are an autonomous agent using Kenzo, powered by the Flux engine, for task management.

RULES:
- All work MUST belong to exactly one project_id.
- You MUST NOT guess or invent a project_id.
- You MUST NOT switch projects without explicit instruction.

STARTUP (MANDATORY):
1. List projects.
2. Select or create ONE project.
3. Confirm the active project_id before any work.

EXECUTION:
- Include project_id in EVERY Flux call.
- Track all work as tasks.
- Update task status as work progresses.
- Close tasks immediately when complete.
- Comment on tasks where appropriate.

CONTEXT LOSS:
- If unsure of project_id, STOP.
- Re-list projects and tasks.
- Ask the user if ambiguity remains.

FORBIDDEN:
- Working without a confirmed project_id.
- Mixing tasks across projects.
- Relying on memory outside Kenzo/Flux.

If these rules cannot be followed, halt and request clarification.
EOF
```
---

## Documentation

Looking for install options, assistant setup, APIs, or webhooks? Start here:

- [`docs/installation-docker.md`](docs/installation-docker.md) - advanced container setup for teams that want a shared server-style deployment.
- [`docs/installation-source.md`](docs/installation-source.md) - build from source, run locally, and get a dev workflow that feels effortless.
- [`docs/cli.md`](docs/cli.md) - full CLI reference for terminal-based task management with MCP parity.
- [`docs/claude-code-plugin.md`](docs/claude-code-plugin.md) - Claude Code plugin that turns your project requirements into a structured Kenzo board with epics, tasks, and dependencies.
- [`docs/assistant-setup.md`](docs/assistant-setup.md) - connect Claude Desktop or ChatGPT and unlock agent-driven work with best-practice guardrails.
- [`docs/ideas.md`](docs/ideas.md) - creative ways to use Kenzo, from agent swarms to automation-first workflows.
- [`docs/mcp.md`](docs/mcp.md) - the complete MCP surface area so your assistants can list, create, and update everything with confidence.
- [`docs/api.md`](docs/api.md) - REST endpoints for building automations, integrations, or custom frontends.
- [`docs/webhooks.md`](docs/webhooks.md) - real-time events with signatures, retries, and examples to power your workflows.
- [`docs/architecture.md`](docs/architecture.md) - understand the monorepo, storage model, and why the Flux engine stays fast and simple.
- [`docs/roadmap.md`](docs/roadmap.md) - where Kenzo is headed and what we are shipping next.

## Dogfooding

Kenzo uses its own Flux engine for task management. Tasks are stored on the `flux-data` branch and synced via git:

```bash
flux pull               # Fetch latest tasks from flux-data branch
flux ready              # Show unblocked tasks sorted by priority
flux task update <id> --status in_progress
flux push "message"     # Commit and push task changes
```

Configure remote server in `.flux/config.json`:
```json
{
  "server": "https://kenzo.example.com",
  "apiKey": "$FLUX_API_KEY"
}
```

The `$FLUX_API_KEY` expands from `.env.local`.

## Ecosystem

Tools that work well with Kenzo:

| Tool | Description |
|------|-------------|
| [Momentum](https://github.com/sirsjg/momentum) | Watches Kenzo/Flux task changes and automatically spawns agents to work on them |
| [Spec Kit](https://github.com/github/spec-kit) | Create spec-driven requirements that generate Kenzo epics and tasks |
| [n8n](https://github.com/n8n-io/n8n) | Workflow automation that triggers on Kenzo events |
| [Zapier](https://zapier.com) | Connect Kenzo to 5,000+ apps via REST API and webhooks |

## Contributing

Kenzo is early and moving quickly. If you want to help shape it, contributions are welcome.
Open an issue for ideas and bugs, or pick something from the roadmap and send a PR.
See `CONTRIBUTING.md` for details.

## License

MIT. See `LICENSE`.
