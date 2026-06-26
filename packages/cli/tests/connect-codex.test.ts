import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
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

describe('connect codex command', () => {
  it('configures Codex MCP with the current workspace FLUX_DIR', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kenzo-connect-'));
    const { bin, log, state } = createFakeCodex(dir);

    try {
      const output = execFileSync('bun', [cliPath, 'connect', 'codex', '--name', 'kenzo-test'], {
        cwd: dir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          CODEX_CLI_PATH: bin,
          FAKE_CODEX_LOG: log,
          FAKE_CODEX_STATE: state,
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

      expect(output).toContain('Codex is connected to Kenzo');
      expect(configured.name).toBe('kenzo-test');
      expect(configured.env).toBe(`FLUX_DIR=${join(realpathSync(dir), '.flux')}`);
      expect(configured.command).toBe('npx');
      expect(configured.commandArgs).toEqual(['-y', '--package', 'kenzoboard', 'kenzoboard-mcp']);
      expect(calls.map(call => call.args.slice(0, 3))).toContainEqual(['mcp', '--help']);
      expect(calls.some(call => call.args[0] === 'mcp' && call.args[1] === 'add')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
