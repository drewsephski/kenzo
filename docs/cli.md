# CLI Reference

The Kenzo CLI (`kenzoboard`) provides terminal control for Kenzo boards, with MCP parity through the Flux engine. Advanced users can still use the compatible `flux` command.

## Installation

```bash
# npm / npx (recommended)
npx kenzoboard
npm install -g kenzoboard

# From source
cd packages/cli && bun run build && bun link

# Docker runs the Kenzo web/API and MCP services
docker run -d -p 3000:3000 -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp
```

## Storage Modes

The CLI supports three storage modes:

### Local File (default)
```bash
kenzoboard init           # Creates .flux/data.json
kenzoboard project list   # Uses local data
```

### SQLite (via FLUX_DATA)
```bash
FLUX_DATA=.flux/data.sqlite kenzoboard project list
```

### Server/Hosted API
Connect to any Kenzo/Flux server (local or remote):

```bash
# Connect to hosted Kenzo instance (with API key for writes)
kenzoboard init --server https://flux.example.com --api-key '$FLUX_API_KEY'

# Or local server (no auth needed in dev mode)
kenzoboard init --server http://localhost:3000

# All commands now use the API
kenzoboard project list   # -> GET /api/projects
kenzoboard task create proj_abc "New task"  # -> POST /api/projects/proj_abc/tasks
```

Server mode stores the URL in `.flux/config.json`. The CLI works identically regardless of mode - all commands are transparently routed to the configured backend.

Config supports `$ENV_VAR` expansion for secrets:
```json
{
  "server": "https://flux.example.com",
  "apiKey": "$FLUX_API_KEY"
}
```

## Commands

### Initialization

```bash
kenzoboard                  # Create/open local workspace and start app
kenzoboard init             # Interactive setup (JSON storage)
kenzoboard init --sqlite    # Use SQLite storage
kenzoboard init --server URL       # Connect to server
kenzoboard init --server URL --api-key KEY  # Server with auth (KEY can be $ENV_VAR)
kenzoboard init --git       # Use git sync (default)
kenzoboard init --no-agents # Skip AGENTS.md update
```

Config is stored in `.flux/config.json` and can be committed to share with your team.

### Projects

```bash
kenzoboard project list                        # List all projects
kenzoboard project create <name>               # Create project
kenzoboard project update <id> --name <n>      # Rename project
kenzoboard project delete <id>                 # Delete project
```

### Epics

```bash
kenzoboard epic list <project>                 # List epics in project
kenzoboard epic create <project> <title>       # Create epic
kenzoboard epic update <id> --title <t>        # Update epic
kenzoboard epic update <id> --status done      # Change status
kenzoboard epic delete <id>                    # Delete epic
```

### Tasks

```bash
kenzoboard task list <project>                 # List tasks
kenzoboard task list <project> --epic <id>     # Filter by epic
kenzoboard task list <project> --status todo   # Filter by status

kenzoboard task create <project> <title>       # Create task
kenzoboard task create <project> <title> -e <epic> -P 0  # With epic and priority

kenzoboard task update <id> --title <t>        # Update title
kenzoboard task update <id> --status in_progress
kenzoboard task update <id> --epic <epic_id>   # Assign to epic
kenzoboard task update <id> --note "context"   # Add note

kenzoboard task start <id>                     # Mark in_progress
kenzoboard task done <id>                      # Mark done
kenzoboard task done <id> --note "completed"   # Done with note

kenzoboard task delete <id>                    # Delete task
```

### Quick Commands

```bash
kenzoboard ready                   # Show unblocked tasks sorted by priority
kenzoboard ready --json            # JSON output
kenzoboard show <id>               # Show task details with comments
```

### Data Sync

**Git-based sync** (for teams, JSON storage only):
```bash
kenzoboard pull                    # Pull from flux-data branch
kenzoboard push                    # Push to flux-data branch
kenzoboard push "commit message"   # Push with custom message
```

> **Note:** Git sync requires JSON storage. SQLite users should use export/import instead.

**Export/Import**:
```bash
kenzoboard export                  # Print JSON to stdout
kenzoboard export -o backup.json   # Export to file
kenzoboard import backup.json      # Import (replace)
kenzoboard import backup.json --merge  # Import (merge)
cat data.json | kenzoboard import -    # Import from stdin
```

### Local Server

Start a local Kenzo server with Web UI + API:

```bash
kenzoboard dev                    # Start/open the local app on http://localhost:3000
kenzoboard serve                  # Uses config or defaults to .flux/data.json
kenzoboard serve -p 8080          # Custom port
kenzoboard serve --data path.json # Override with JSON file
kenzoboard serve --data path.sqlite  # Override with SQLite file
```

Reads `.flux/config.json` to determine storage backend. Serves both the web dashboard and REST API.

## Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `-P, --priority` | Priority: 0 (P0), 1 (P1), 2 (P2) |
| `-e, --epic` | Epic ID |
| `--note` | Add note/comment |
| `--status` | Filter or set status |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FLUX_DIR` | Override .flux directory location |
| `FLUX_DATA` | Data file path (`.sqlite`/`.db` for SQLite) |

## Examples

```bash
# Quick workflow
kenzoboard
kenzoboard project create "My Project"
kenzoboard task create proj_abc "Fix login bug" -P 0
kenzoboard task start task_xyz
kenzoboard task done task_xyz --note "Fixed by adding null check"

# Agent workflow
kenzoboard ready --json | jq '.[0]'  # Get next task
kenzoboard task start task_123
kenzoboard task done task_123

# Team sync
kenzoboard pull
kenzoboard task create proj_abc "New feature"
kenzoboard push "added new feature task"
```

## Flux Compatibility

The `flux` bin is still published by the `kenzoboard` package. Existing commands such as `flux ready`, `flux task create ...`, `flux pull`, and `flux push` continue to work. `.flux/`, `flux-data`, and `flux://` remain engine-level compatibility names.
