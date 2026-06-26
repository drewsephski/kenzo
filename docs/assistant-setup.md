# Assistant Setup

Ready to make Kenzo the shared board for your human and agent workflows? Kenzo is powered by the Flux engine, so MCP configs keep the `flux` server name and `flux://` resources for compatibility.

## Claude Desktop

### npm / npx (recommended)

Add the Flux MCP server for Kenzo to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "flux": {
      "command": "npx",
      "args": ["-y", "--package", "kenzoboard", "kenzoboard-mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

### Global install

If you installed Kenzo globally:

```json
{
  "mcpServers": {
    "flux": {
      "command": "kenzoboard-mcp"
    }
  }
}
```

### Advanced Docker

```json
{
  "mcpServers": {
    "flux": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "flux-data:/app/packages/data", "-e", "FLUX_DATA=/app/packages/data/flux.sqlite", "flux-mcp"]
    }
  }
}
```

## ChatGPT

If your ChatGPT client supports MCP servers, add the Flux MCP server for Kenzo as a custom MCP server using the same npm or global command shown above. The exact menu name can vary by client, but look for MCP or Connectors in Settings.

### npm / npx

```
Command: npx
Args: -y --package kenzoboard kenzoboard-mcp
```

### Global install

```
Command: kenzoboard-mcp
Args:
```

If your ChatGPT client does not support MCP servers, you can still use Kenzo via the REST API and webhooks in `docs/api.md` and `docs/webhooks.md`.

## Best Practices for a Smooth, Powerful Setup

- Keep one shared `.flux` data location so your web UI and assistants stay in sync. Use `FLUX_DIR` only when you intentionally want to point multiple repos at the same workspace.
- Give your assistant a strict project_id workflow. The AGENTS.md snippet in the quickstart keeps agents honest and makes tasks reliable.
- Create one project per initiative. It keeps context clean and prevents accidental cross-project updates.
- Use clear task titles and short notes. Your assistant will generate better plans and fewer follow-up questions.
- Turn on webhooks for your favorite tools and set a secret for signatures. It is the fastest path to automations that feel alive.
- Back up `.flux/data.json` or your configured `FLUX_DATA` path. That file is the single source of truth.
- Start every session by listing projects and tasks. It primes the assistant and cuts down on surprises.

If you want, I can add a ready-made agent prompt template and a minimal webhook example next.
