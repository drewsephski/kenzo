import { cpSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliRoot = resolve(repoRoot, 'packages/cli');
const webDist = resolve(repoRoot, 'packages/web/dist');
const cliDist = resolve(cliRoot, 'dist');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.KENZO_WEB_BUILT !== '1' || !existsSync(resolve(webDist, 'index.html'))) {
  run('bun', ['run', '--filter', '@flux/web', 'build']);
}

rmSync(cliDist, { recursive: true, force: true });

const nodeBundleArgs = ['--target', 'node', '--external', 'bun:sqlite'];

run('bun', ['build', 'src/index.ts', '--outfile', 'dist/index.js', ...nodeBundleArgs], { cwd: cliRoot });
run('bun', ['build', '../mcp/src/index.ts', '--outfile', 'dist/mcp.js', ...nodeBundleArgs], { cwd: cliRoot });

cpSync(webDist, resolve(cliDist, 'web'), { recursive: true });

chmodSync(resolve(cliDist, 'index.js'), 0o755);
chmodSync(resolve(cliDist, 'mcp.js'), 0o755);
