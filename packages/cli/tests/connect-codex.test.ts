import { describe, expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { execFileSync } from 'child_process';

const cliPath = resolve(import.meta.dirname, '../src/index.ts');

function createFakeCodex(dir: string): { bin: string; log: string; state: string } {
  const bin = join(dir, 'fake-codex.js');
  const log = join(dir, 'codex-calls.jsonl');
  const state = join(dir, 'codex-state.json');

  writeFileSync(bin, `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_CODEX_LOG, JSON.stringify({ args }) + '\\n');

if (args[0] === 'mcp' && args[1] === '--help') {
  console.log('Manage external MCP servers for Codex');
  process.exit(0);
}

if (args[0] === 'mcp' && args[1] === 'get') {
  const name = args[2];
  if (fs.existsSync(process.env.FAKE_CODEX_STATE)) {
    const state = JSON.parse(fs.readFileSync(process.env.FAKE_CODEX_STATE, 'utf8'));
    if (state.name === name) {
      console.log(name);
      console.log('  command: ' + state.command);
      console.log('  args: ' + state.commandArgs.join(' '));
      console.log('  env: FLUX_DIR=*****');
      process.exit(0);
    }
  }
  console.error('No MCP server named ' + name);
  process.exit(1);
}

if (args[0] === 'mcp' && args[1] === 'remove') {
  if (fs.existsSync(process.env.FAKE_CODEX_STATE)) fs.unlinkSync(process.env.FAKE_CODEX_STATE);
  console.log("Removed global MCP server '" + args[2] + "'.");
  process.exit(0);
}

if (args[0] === 'mcp' && args[1] === 'add') {
  const separatorIndex = args.indexOf('--');
  const envIndex = args.indexOf('--env');
  fs.writeFileSync(process.env.FAKE_CODEX_STATE, JSON.stringify({
    name: args[2],
    env: args[envIndex + 1],
    command: args[separatorIndex + 1],
    commandArgs: args.slice(separatorIndex + 2),
  }, null, 2));
  console.log("Added global MCP server '" + args[2] + "'.");
  process.exit(0);
}

console.error('Unexpected fake Codex invocation: ' + args.join(' '));
process.exit(1);
`);
  chmodSync(bin, 0o755);

  return { bin, log, state };
}

function createFakeMcp(dir: string, toolNames = ['list_ready_tasks']): { bin: string; log: string } {
  const mcpDir = join(dir, 'packages/mcp/dist');
  const bin = join(mcpDir, 'index.js');
  const log = join(dir, 'mcp-calls.jsonl');
  mkdirSync(mcpDir, { recursive: true });
  const tools = toolNames.map(name => ({ name }));

  writeFileSync(bin, `#!/usr/bin/env node
const fs = require('fs');
const tools = ${JSON.stringify(tools)};
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.FAKE_MCP_LOG, JSON.stringify({ fluxDir: process.env.FLUX_DIR }) + '\\n');
  for (const line of input.trim().split('\\n')) {
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'fake-kenzo', version: '0.0.0' },
        },
      }));
    }
    if (message.method === 'tools/list') {
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: { tools },
      }));
    }
  }
});
`);
  chmodSync(bin, 0o755);

  return { bin, log };
}

describe('connect codex command', () => {
  it('configures Codex MCP with the current workspace FLUX_DIR', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kenzo-connect-'));
    const { bin, log, state } = createFakeCodex(dir);
    const fakeMcp = createFakeMcp(dir);

    try {
      const output = execFileSync('bun', [cliPath, 'connect', 'codex', '--name', 'kenzo-test'], {
        cwd: dir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          CODEX_CLI_PATH: bin,
          FAKE_CODEX_LOG: log,
          FAKE_CODEX_STATE: state,
          FAKE_MCP_LOG: fakeMcp.log,
        },
      });

      const configured = JSON.parse(readFileSync(state, 'utf-8')) as {
        name: string;
        env: string;
        command: string;
        commandArgs: string[];
      };
      const calls = readFileSync(log, 'utf-8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { args: string[] });
      const mcpCalls = readFileSync(fakeMcp.log, 'utf-8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { fluxDir: string });
      const fluxDir = join(realpathSync(dir), '.flux');

      expect(output).toContain('Codex is connected to Kenzo');
      expect(output).toContain('MCP tools: verified');
      expect(configured.name).toBe('kenzo-test');
      expect(configured.env).toBe(`FLUX_DIR=${fluxDir}`);
      expect(configured.command).toBe('bun');
      expect(configured.commandArgs).toEqual([realpathSync(fakeMcp.bin)]);
      expect(calls.map(call => call.args.slice(0, 3))).toContainEqual(['mcp', '--help']);
      expect(calls.some(call => call.args[0] === 'mcp' && call.args[1] === 'add')).toBe(true);
      expect(mcpCalls).toContainEqual({ fluxDir });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not replace an existing Codex MCP server when tool verification fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kenzo-connect-'));
    const { bin, log, state } = createFakeCodex(dir);
    const fakeMcp = createFakeMcp(dir, ['unexpected_tool']);
    const existingConfig = {
      name: 'kenzo-test',
      env: 'FLUX_DIR=/existing',
      command: 'existing-command',
      commandArgs: ['--keep'],
    };
    writeFileSync(state, JSON.stringify(existingConfig, null, 2));

    try {
      let failed = false;
      let stderr = '';
      try {
        execFileSync('bun', [cliPath, 'connect', 'codex', '--name', 'kenzo-test'], {
          cwd: dir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            CODEX_CLI_PATH: bin,
            FAKE_CODEX_LOG: log,
            FAKE_CODEX_STATE: state,
            FAKE_MCP_LOG: fakeMcp.log,
          },
        });
      } catch (e: any) {
        failed = true;
        stderr = e?.stderr?.toString() || '';
      }

      const configured = JSON.parse(readFileSync(state, 'utf-8'));
      const calls = readFileSync(log, 'utf-8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { args: string[] });

      expect(failed).toBe(true);
      expect(stderr).toContain('Failed to configure Codex MCP');
      expect(configured).toEqual(existingConfig);
      expect(calls.some(call => call.args[0] === 'mcp' && call.args[1] === 'remove')).toBe(false);
      expect(calls.some(call => call.args[0] === 'mcp' && call.args[1] === 'add')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
