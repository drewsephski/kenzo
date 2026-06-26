import { spawn } from 'child_process';
import {
  isServerMode,
  getServerUrl,
  getApiKeys,
  createApiKeyRemote,
  deleteApiKeyRemote,
  initCliAuth,
  pollCliAuth,
  getProjects,
} from '../client.js';
import { output } from '../index.js';
import { writeConfig, readConfigRaw, findFluxDir } from '../config.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

// Open URL in default browser (using spawn to avoid shell injection)
function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
    ? 'cmd'
    : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.on('error', (err) => {
    console.error('Failed to open browser:', err.message);
  });
  child.unref();
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function authCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean | string[]>,
  json: boolean
): Promise<void> {
  if (!isServerMode()) {
    console.error('Auth commands only available in server mode');
    console.error('Run: kenzoboard init --server URL');
    process.exit(1);
  }

  switch (subcommand) {
    case undefined:
    case 'login': {
      // Browser-based auth flow
      const serverUrl = getServerUrl();
      if (!serverUrl) {
        console.error('No server URL configured');
        process.exit(1);
      }

      console.log(`${c.bold}Kenzo Authentication${c.reset} ${c.dim}(Flux engine)${c.reset}\n`);
      console.log('Starting browser auth flow...\n');

      // Get temp token from server
      const { token, expires_at } = await initCliAuth();
      const authUrl = `${serverUrl}/auth?token=${token}`;

      console.log(`Opening: ${c.cyan}${authUrl}${c.reset}\n`);
      openBrowser(authUrl);

      console.log('Waiting for confirmation in browser...');
      console.log(`${c.dim}(Press Ctrl+C to cancel)${c.reset}\n`);

      // Poll for completion
      const timeout = new Date(expires_at).getTime() - Date.now();
      const pollInterval = 2000;
      const maxAttempts = Math.ceil(timeout / pollInterval);

      for (let i = 0; i < maxAttempts; i++) {
        await sleep(pollInterval);
        const result = await pollCliAuth(token);

        if (result.status === 'completed' && result.apiKey) {
          // Save API key to config
          const fluxDir = findFluxDir();
          const config = readConfigRaw(fluxDir);
          config.apiKey = result.apiKey;
          writeConfig(fluxDir, config);

          console.log(`${c.green}✓${c.reset} Authenticated successfully!`);
          console.log(`  API key saved to .flux/config.json`);
          return;
        }

        if (result.status === 'expired') {
          console.error(`${c.red}✗${c.reset} Auth request expired. Try again.`);
          process.exit(1);
        }

        // Still pending, show progress
        process.stdout.write('.');
      }

      console.error(`\n${c.red}✗${c.reset} Auth timed out. Try again.`);
      process.exit(1);
    }

    case 'create-key': {
      // Create API key directly (requires existing auth)
      const name = flags.name as string || args[0];
      if (!name) {
        console.error('Usage: kenzoboard auth create-key --name "Key Name" [-p PROJECT_ID]');
        process.exit(1);
      }

      const projectId = flags.p as string || flags.project as string;
      let projectIds: string[] | undefined;

      if (projectId) {
        // Validate project exists
        const projects = await getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
          console.error(`Project not found: ${projectId}`);
          process.exit(1);
        }
        projectIds = [projectId];
      }

      const result = await createApiKeyRemote(name, projectIds);

      if (json) {
        output({ key: result.key, ...result }, true);
      } else {
        console.log(`${c.green}✓${c.reset} Created API key: ${c.bold}${result.name}${c.reset}`);
        console.log(`  Prefix: ${result.prefix}...`);
        console.log(`  Scope:  ${result.scope.type === 'server' ? 'server (full access)' : `project (${projectIds?.join(', ')})`}`);
        console.log('');
        console.log(`${c.yellow}⚠${c.reset}  Save this key - it won't be shown again:`);
        console.log(`${c.bold}${result.key}${c.reset}`);
      }
      break;
    }

    case 'list-keys': {
      const keys = await getApiKeys();
      if (json) {
        output(keys, true);
      } else {
        if (keys.length === 0) {
          console.log('No API keys configured');
        } else {
          console.log(`${c.bold}API Keys${c.reset}\n`);
          for (const key of keys) {
            const scope = key.scope.type === 'server'
              ? 'server'
              : `project (${key.scope.project_ids.join(', ')})`;
            console.log(`${key.prefix}...  ${key.name}  [${scope}]  ${c.dim}${key.id}${c.reset}`);
            if (key.last_used_at) {
              console.log(`  ${c.dim}Last used: ${new Date(key.last_used_at).toLocaleString()}${c.reset}`);
            }
          }
        }
      }
      break;
    }

    case 'revoke': {
      const id = args[0];
      if (!id) {
        console.error('Usage: kenzoboard auth revoke <key-id>');
        process.exit(1);
      }
      const success = await deleteApiKeyRemote(id);
      if (!success) {
        console.error(`Key not found: ${id}`);
        process.exit(1);
      }
      output(json ? { revoked: id } : `Revoked API key: ${id}`, json);
      break;
    }

    case 'status': {
      try {
        const keys = await getApiKeys();
        if (json) {
          output({ authenticated: true, keyCount: keys.length }, true);
        } else {
          console.log(`${c.green}✓${c.reset} Authenticated`);
          console.log(`  ${keys.length} API key${keys.length !== 1 ? 's' : ''} configured`);
        }
      } catch (e: any) {
        if (e.message?.includes('Unauthorized') || e.status === 401) {
          if (json) {
            output({ authenticated: false }, true);
          } else {
            console.log(`${c.yellow}!${c.reset} Not authenticated or insufficient permissions`);
            console.log(`  Run ${c.cyan}kenzoboard auth${c.reset} to authenticate`);
          }
        } else {
          throw e;
        }
      }
      break;
    }

    default:
      console.error('Usage: kenzoboard auth [login|create-key|list-keys|revoke|status]');
      process.exit(1);
  }
}
