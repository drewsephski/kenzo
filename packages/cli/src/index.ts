#!/usr/bin/env node

import { resolve, dirname, basename } from 'path';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, cpSync, realpathSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { createInterface } from 'readline';
import { setStorageAdapter, initStore } from '@flux/shared';
import { createAdapter } from '@flux/shared/adapters';
import { createFilesystemBlobStorage, setBlobStorage } from '@flux/shared/blob-storage';
import { type FluxConfig, findFluxDir, readConfig, readConfigRaw, writeConfig, loadEnvLocal, resolveDataPath } from './config.js';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  cyanBright: '\x1b[96m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};

// Interactive prompt helper
function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Check if running interactively
function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}

// Commands
import { projectCommand } from './commands/project.js';
import { epicCommand } from './commands/epic.js';
import { taskCommand } from './commands/task.js';
import { readyCommand } from './commands/ready.js';
import { showCommand } from './commands/show.js';
import { serveCommand } from './commands/serve.js';
import { primeCommand } from './commands/prime.js';
import { authCommand } from './commands/auth.js';
import { blobCommand } from './commands/blob.js';
import { initClient, exportAll, importAll, getProjects, createProject } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function publicCommandName(): 'kenzoboard' | 'flux' {
  const invoked = basename(process.argv[1] || '');
  return invoked === 'flux' ? 'flux' : 'kenzoboard';
}

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) return false;

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

function defaultServePort(): number {
  return publicCommandName() === 'flux' ? 3589 : 3000;
}

function ensureFluxIgnored(): boolean {
  const gitRoot = findGitRoot();
  const gitignorePath = gitRoot ? resolve(gitRoot, '.gitignore') : resolve(process.cwd(), '.gitignore');
  const gitignoreEntry = '.flux/';
  let gitignoreContent = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  if (!gitignoreContent.split('\n').some(line => line.trim() === gitignoreEntry)) {
    const newline = gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n') ? '\n' : '';
    appendFileSync(gitignorePath, `${newline}${gitignoreEntry}\n`);
    return true;
  }
  return false;
}

type KenzoWorkspace = {
  fluxDir: string;
  projectId?: string;
  projectName?: string;
  createdWorkspace: boolean;
  createdProject: boolean;
  gitignoreUpdated: boolean;
};

async function ensureKenzoWorkspace(): Promise<KenzoWorkspace> {
  const fluxDir = process.env.FLUX_DIR || resolve(process.cwd(), '.flux');
  const configPath = resolve(fluxDir, 'config.json');
  const jsonPath = resolve(fluxDir, 'data.json');
  const sqlitePath = resolve(fluxDir, 'data.sqlite');
  let createdWorkspace = false;
  let createdProject = false;
  let gitignoreUpdated = false;

  if (!existsSync(fluxDir)) {
    mkdirSync(fluxDir, { recursive: true });
    writeConfig(fluxDir, {});
    writeFileSync(jsonPath, JSON.stringify({ projects: [], epics: [], tasks: [] }, null, 2));
    gitignoreUpdated = ensureFluxIgnored();
    createdWorkspace = true;
  } else if (!existsSync(configPath)) {
    writeConfig(fluxDir, {});
  }

  const config = readConfigRaw(fluxDir);
  if (!config.server && !existsSync(jsonPath) && !existsSync(sqlitePath)) {
    writeFileSync(jsonPath, JSON.stringify({ projects: [], epics: [], tasks: [] }, null, 2));
  }

  const storage = initStorage();
  const projects = await getProjects();
  let projectId = storage.project;
  let projectName = projects.find(project => project.id === projectId)?.name;

  if (projects.length === 0) {
    const defaultName = basename(process.cwd()) || 'Kenzo';
    const project = await createProject(defaultName);
    projectId = project.id;
    projectName = project.name;
    const nextConfig = readConfigRaw(fluxDir);
    nextConfig.project = project.id;
    writeConfig(fluxDir, nextConfig);
    createdProject = true;
  } else if (!projectId || !projects.some(project => project.id === projectId)) {
    const project = projects[0];
    projectId = project.id;
    projectName = project.name;
    const nextConfig = readConfigRaw(fluxDir);
    nextConfig.project = project.id;
    writeConfig(fluxDir, nextConfig);
  }

  return { fluxDir, projectId, projectName, createdWorkspace, createdProject, gitignoreUpdated };
}

function codexCliCommand(): string {
  const macAppCli = '/Applications/Codex.app/Contents/Resources/codex';
  return process.platform === 'darwin' && existsSync(macAppCli) ? macAppCli : 'codex';
}

function quoteShell(value: string): string {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function mcpPackageCommand(): string {
  const localMcpPath = resolve(process.cwd(), 'packages/mcp/dist/index.js');
  return existsSync(localMcpPath)
    ? `bun ${quoteShell(localMcpPath)}`
    : 'npx -y --package kenzoboard kenzoboard-mcp';
}

function codexMcpCommand(fluxDir: string): string {
  return `${codexCliCommand()} mcp add flux --env FLUX_DIR=${quoteShell(fluxDir)} -- ${mcpPackageCommand()}`;
}

function claudeMcpCommand(fluxDir: string): string {
  return `claude mcp add flux --env FLUX_DIR=${quoteShell(fluxDir)} -- ${mcpPackageCommand()}`;
}

function printLaunchSummary(workspace: KenzoWorkspace, command = publicCommandName()): void {
  const projectLabel = workspace.projectName && workspace.projectId
    ? `${workspace.projectName} (${workspace.projectId})`
    : 'No project selected';

  console.log(`${c.green}${c.bold}Kenzo is ready.${c.reset}`);
  console.log(`Project: ${projectLabel}`);
  if (workspace.createdWorkspace || workspace.createdProject || workspace.gitignoreUpdated) {
    const details = [
      workspace.createdWorkspace ? 'local workspace' : undefined,
      workspace.createdProject ? 'first project' : undefined,
      workspace.gitignoreUpdated ? '.flux/ in .gitignore' : undefined,
    ].filter(Boolean).join(', ');
    console.log(`${c.dim}Set up ${details}.${c.reset}`);
  }

  console.log('');
  console.log(`${c.bold}Connect Codex:${c.reset}`);
  console.log(`  ${codexMcpCommand(workspace.fluxDir)}`);
  console.log('');
  console.log(`${c.bold}Then ask Codex:${c.reset}`);
  console.log('  Pick the next ready Kenzo task, implement it, and mark it done.');
  console.log('');
  console.log(`CLI fallback: ${c.cyan}${command} ready${c.reset}`);
  console.log(`More setup:   ${c.cyan}${command} mcp${c.reset}`);
}

function printMcpSetup(command = publicCommandName(), fluxDir = findFluxDir()): void {
  const installedMcpCommand = 'kenzoboard-mcp';
  const dockerCommand = 'docker run -i --rm -v "$(pwd)/.flux:/app/packages/data" -e FLUX_DATA=/app/packages/data/flux.sqlite flux-mcp bun packages/mcp/dist/index.js';

  console.log(`${c.bold}Agent setup${c.reset} ${c.dim}(MCP resources remain flux:// for compatibility)${c.reset}`);
  console.log(`${c.dim}Using Kenzo workspace: ${fluxDir}${c.reset}\n`);

  console.log(`${c.bold}Codex:${c.reset}`);
  console.log(`  ${codexMcpCommand(fluxDir)}`);

  console.log(`${c.bold}Claude Code:${c.reset}`);
  console.log(`  ${claudeMcpCommand(fluxDir)}`);

  console.log('');
  console.log(`${c.bold}Global install:${c.reset}`);
  console.log(`  ${installedMcpCommand}`);
  console.log('');
  console.log(`${c.bold}Advanced Docker:${c.reset}`);
  console.log(`  ${dockerCommand}`);
  console.log('');
  console.log(`${c.bold}Agent workflow:${c.reset}`);
  console.log(`  1. Run ${c.cyan}${command} ready${c.reset} or ask the MCP server for ready tasks.`);
  console.log('  2. Start one task, implement it, add notes as needed, then mark it done.');
  console.log('  3. If MCP is not connected yet, Codex can still use the CLI commands from AGENTS.md.');
}

async function launchKenzoApp(): Promise<void> {
  const command = publicCommandName();
  const workspace = await ensureKenzoWorkspace();

  printLaunchSummary(workspace, command);

  await serveCommand([], { port: String(defaultServePort()) }, { defaultPort: defaultServePort(), open: true, compact: true });
}

// Flux instructions for AGENTS.md/CLAUDE.md
const FLUX_INSTRUCTIONS = `<!-- FLUX:START -->
## Flux Task Management

You have access to Flux for task management via MCP or CLI.

**Rules:**
- All work MUST belong to exactly one project_id
- Do NOT guess or invent a project_id
- Track all work as tasks; update status as you progress
- Close tasks immediately when complete

**Startup:**
1. List projects (\`flux project list\`)
2. Select or create ONE project
3. Confirm active project_id before any work

**If context is lost:** Re-list projects/tasks. Ask user if ambiguous.
<!-- FLUX:END -->`;

// Update AGENTS.md or CLAUDE.md with flux instructions
function updateAgentInstructions(): string | null {
  const cwd = process.cwd();
  const candidates = ['AGENTS.md', 'CLAUDE.md'];

  let targetFile: string | null = null;
  for (const name of candidates) {
    const path = resolve(cwd, name);
    if (existsSync(path)) {
      targetFile = path;
      break;
    }
  }

  // Default to AGENTS.md if none exist
  if (!targetFile) {
    targetFile = resolve(cwd, 'AGENTS.md');
  }

  let content = existsSync(targetFile) ? readFileSync(targetFile, 'utf-8') : '';

  const startMarker = '<!-- FLUX:START -->';
  const endMarker = '<!-- FLUX:END -->';
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    content = content.slice(0, startIdx) + FLUX_INSTRUCTIONS + content.slice(endIdx + endMarker.length);
  } else {
    // Append section
    content = content.trimEnd() + '\n\n' + FLUX_INSTRUCTIONS + '\n';
  }

  writeFileSync(targetFile, content.trimStart());
  return targetFile;
}

// Find git root directory
function findGitRoot(): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// Ensure worktree exists for flux-data branch
function ensureWorktree(gitRoot: string): string {
  const worktreePath = resolve(gitRoot, '.git', 'flux-worktree');

  if (existsSync(worktreePath)) {
    return worktreePath;
  }

  // Check if flux-data branch exists locally or remotely
  const branchExists = ['flux-data', 'origin/flux-data'].some(ref => {
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: 'pipe', cwd: gitRoot });
      return true;
    } catch { return false; }
  });

  if (!branchExists) {
    // Create orphan branch
    execSync('git checkout --orphan flux-data', { stdio: 'pipe', cwd: gitRoot });
    try {
      execSync('git rm -rf .', { stdio: 'pipe', cwd: gitRoot });
    } catch { /* ignore - may fail if nothing to remove */ }
    execSync('git commit --allow-empty -m "init flux-data"', { stdio: 'pipe', cwd: gitRoot });
    execSync('git checkout -', { stdio: 'pipe', cwd: gitRoot });
  }

  // Create worktree
  execSync(`git worktree add "${worktreePath}" flux-data`, { stdio: 'pipe', cwd: gitRoot });
  return worktreePath;
}

// Initialize storage (file or server mode)
function initStorage(): { mode: 'file' | 'server'; serverUrl?: string; project?: string } {
  const fluxDir = findFluxDir();
  loadEnvLocal(fluxDir);  // Load .env.local before reading config
  const config = readConfig(fluxDir);

  if (config.server) {
    // Server mode - initialize client with server URL and API key
    initClient(config.server, config.apiKey);
    return { mode: 'server', serverUrl: config.server, project: config.project };
  }

  // File mode - use local storage + initialize client without server
  const dataPath = resolveDataPath(fluxDir, config);
  const adapter = createAdapter(dataPath);
  setStorageAdapter(adapter);
  initStore();
  initClient(); // No server = local mode

  // Initialize blob storage
  const blobsDir = resolve(fluxDir, 'blobs');
  setBlobStorage(createFilesystemBlobStorage(blobsDir));

  return { mode: 'file', project: config.project };
}

// Doctor command - diagnose and fix common issues
async function doctorCommand(flags: Record<string, string | boolean | string[]>): Promise<void> {
  const fix = flags.fix === true;
  let issues = 0;
  let fixed = 0;

  console.log(`${c.bold}Kenzo Doctor${c.reset} ${c.dim}(Flux engine)${c.reset}\n`);

  // Check 1: .flux directory exists
  let fluxDir: string;
  try {
    fluxDir = findFluxDir();
  } catch {
    console.log(`${c.yellow}!${c.reset} No .flux directory found`);
    console.log(`  Run ${c.cyan}${publicCommandName()} init${c.reset} to initialize\n`);
    return;
  }

  const fluxDirExists = existsSync(fluxDir);
  if (!fluxDirExists) {
    console.log(`${c.yellow}!${c.reset} .flux directory not found at ${fluxDir}`);
    console.log(`  Run ${c.cyan}${publicCommandName()} init${c.reset} to initialize\n`);
    return;
  }
  console.log(`${c.green}OK${c.reset} .flux directory: ${fluxDir}`);

  // Check 2: config.json exists
  const configPath = resolve(fluxDir, 'config.json');
  const configExists = existsSync(configPath);
  if (configExists) {
    const config = readConfig(fluxDir);
    const mode = config.server ? 'server' : 'local';
    const backend = config.dataFile?.endsWith('.sqlite') ? 'sqlite' : 'json';
    console.log(`${c.green}OK${c.reset} config.json: ${mode} mode, ${backend} backend`);
  } else {
    console.log(`${c.yellow}!${c.reset} No config.json found (using defaults)`);
    issues++;
  }

  // Check 3: Look for split database issue
  const jsonPath = resolve(fluxDir, 'data.json');
  const sqlitePath = resolve(fluxDir, 'data.sqlite');
  const jsonExists = existsSync(jsonPath);
  const sqliteExists = existsSync(sqlitePath);

  // Helper to count records in a data file
  const countRecords = (path: string): { projects: number; epics: number; tasks: number } | null => {
    try {
      const adapter = createAdapter(path);
      adapter.read(); // populates adapter.data
      const data = adapter.data;
      return {
        projects: data.projects?.length || 0,
        epics: data.epics?.length || 0,
        tasks: data.tasks?.length || 0,
      };
    } catch {
      return null;
    }
  };

  const jsonCounts = jsonExists ? countRecords(jsonPath) : null;
  const sqliteCounts = sqliteExists ? countRecords(sqlitePath) : null;

  const jsonHasData = jsonCounts && (jsonCounts.projects > 0 || jsonCounts.tasks > 0);
  const sqliteHasData = sqliteCounts && (sqliteCounts.projects > 0 || sqliteCounts.tasks > 0);

  // Determine which file config points to
  const config = configExists ? readConfig(fluxDir) : {};

  // Server mode - skip local file checks
  if (config.server) {
    console.log(`${c.dim}Skipping local data file checks (server mode)${c.reset}`);
    console.log('');
    console.log(`${c.green}All checks passed!${c.reset}`);
    return;
  }

  const configuredFile = config.dataFile?.endsWith('.sqlite') ? 'sqlite' : 'json';
  const configuredPath = configuredFile === 'sqlite' ? sqlitePath : jsonPath;
  const otherPath = configuredFile === 'sqlite' ? jsonPath : sqlitePath;
  const otherFile = configuredFile === 'sqlite' ? 'json' : 'sqlite';

  if (jsonExists && sqliteExists) {
    // Both files exist - potential split database
    console.log(`\n${c.yellow}!${c.reset} Multiple data files detected:`);
    if (jsonCounts) {
      const marker = configuredFile === 'json' ? ` ${c.green}(configured)${c.reset}` : '';
      console.log(`  data.json:   ${jsonCounts.projects} projects, ${jsonCounts.epics} epics, ${jsonCounts.tasks} tasks${marker}`);
    }
    if (sqliteCounts) {
      const marker = configuredFile === 'sqlite' ? ` ${c.green}(configured)${c.reset}` : '';
      console.log(`  data.sqlite: ${sqliteCounts.projects} projects, ${sqliteCounts.epics} epics, ${sqliteCounts.tasks} tasks${marker}`);
    }

    if (jsonHasData && sqliteHasData) {
      issues++;
      console.log(`\n${c.yellow}WARNING:${c.reset} Both files contain data - possible split database issue.`);
      console.log(`  This can happen if MCP/Server used a different file than CLI.`);

      if (fix) {
        // Initialize storage pointing to configured file before merge
        const primaryAdapter = createAdapter(configuredPath);
        setStorageAdapter(primaryAdapter);
        initStore();
        initClient();

        // Merge other file into configured file
        console.log(`\n${c.cyan}Merging ${otherFile} into ${configuredFile}...${c.reset}`);
        const otherAdapter = createAdapter(otherPath);
        otherAdapter.read(); // populates adapter.data
        await importAll(otherAdapter.data, true); // merge mode

        // Backup then remove the other file
        const backupPath = `${otherPath}.backup-${Date.now()}`;
        const { renameSync } = await import('fs');
        renameSync(otherPath, backupPath);
        console.log(`${c.green}OK${c.reset} Merged and backed up ${otherFile} file to ${backupPath}`);
        fixed++;
      } else {
        console.log(`\n  To fix: ${c.cyan}flux doctor --fix${c.reset}`);
        console.log(`  This will merge data.${otherFile} into data.${configuredFile} and remove the duplicate.`);
      }
    } else if (!jsonHasData && jsonExists) {
      // Empty JSON file exists alongside SQLite
      issues++;
      console.log(`\n${c.dim}data.json is empty (likely created by old MCP/Server bug)${c.reset}`);
      if (fix) {
        const { unlinkSync } = await import('fs');
        unlinkSync(jsonPath);
        console.log(`${c.green}OK${c.reset} Removed empty data.json`);
        fixed++;
      } else {
        console.log(`  To fix: ${c.cyan}flux doctor --fix${c.reset} (removes empty file)`);
      }
    } else if (!sqliteHasData && sqliteExists) {
      // Empty SQLite file exists alongside JSON
      issues++;
      console.log(`\n${c.dim}data.sqlite is empty${c.reset}`);
      if (fix) {
        const { unlinkSync } = await import('fs');
        unlinkSync(sqlitePath);
        console.log(`${c.green}OK${c.reset} Removed empty data.sqlite`);
        fixed++;
      } else {
        console.log(`  To fix: ${c.cyan}flux doctor --fix${c.reset} (removes empty file)`);
      }
    }
  } else if (jsonExists || sqliteExists) {
    const activePath = jsonExists ? jsonPath : sqlitePath;
    const activeCounts = jsonExists ? jsonCounts : sqliteCounts;
    const activeFile = jsonExists ? 'json' : 'sqlite';
    if (activeCounts) {
      console.log(`${c.green}OK${c.reset} data.${activeFile}: ${activeCounts.projects} projects, ${activeCounts.epics} epics, ${activeCounts.tasks} tasks`);
    }
  } else {
    console.log(`${c.yellow}!${c.reset} No data file found`);
  }

  // Summary
  console.log('');
  if (issues === 0) {
    console.log(`${c.green}All checks passed!${c.reset}`);
  } else if (fix && fixed === issues) {
    console.log(`${c.green}Fixed ${fixed} issue${fixed > 1 ? 's' : ''}!${c.reset}`);
  } else if (fix && fixed < issues) {
    console.log(`${c.yellow}Fixed ${fixed}/${issues} issues${c.reset}`);
  } else {
    console.log(`${c.yellow}Found ${issues} issue${issues > 1 ? 's' : ''}${c.reset} - run ${c.cyan}flux doctor --fix${c.reset} to repair`);
  }
}

// Flags that can appear multiple times (collected into arrays)
const ARRAY_FLAGS = new Set(['ac', 'guardrail']);

// Parse arguments
export function parseArgs(args: string[]): { command: string; subcommand?: string; args: string[]; flags: Record<string, string | boolean | string[]> } {
  const flags: Record<string, string | boolean | string[]> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        if (ARRAY_FLAGS.has(key)) {
          // Collect into array
          if (!flags[key]) flags[key] = [];
          (flags[key] as string[]).push(next);
        } else {
          flags[key] = next;
        }
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        if (ARRAY_FLAGS.has(key)) {
          if (!flags[key]) flags[key] = [];
          (flags[key] as string[]).push(next);
        } else {
          flags[key] = next;
        }
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] || 'help',
    subcommand: positional[1],
    args: positional.slice(2),
    flags,
  };
}

// Output helper
export function output(data: unknown, json: boolean): void {
  console.log(json ? JSON.stringify(data, null, 2) : data);
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await launchKenzoApp();
    return;
  }

  const parsed = parseArgs(args);
  const json = parsed.flags.json === true;

  // Handle init separately (before storage init)
  if (parsed.command === 'init') {
    const fluxDir = process.env.FLUX_DIR || resolve(process.cwd(), '.flux');
    const useSqlite = parsed.flags.sqlite === true;
    const dataFileName = useSqlite ? 'data.sqlite' : 'data.json';
    const dataPath = resolve(fluxDir, dataFileName);
    const configPath = resolve(fluxDir, 'config.json');
    const isNew = !existsSync(resolve(fluxDir, 'data.json')) && !existsSync(resolve(fluxDir, 'data.sqlite'));

    mkdirSync(fluxDir, { recursive: true });

    // Determine mode: --server flag, interactive prompt, or default to git
    let serverUrl: string | undefined = parsed.flags.server as string | undefined;
    let apiKey: string | undefined = parsed.flags['api-key'] as string | undefined;
    const useGit = parsed.flags.git === true;

    // Check for existing config mismatch BEFORE interactive prompts
    if (existsSync(configPath)) {
      try {
        const existing = JSON.parse(readFileSync(configPath, 'utf-8'));
        const warnings: string[] = [];

        // Mode mismatch (only check if user explicitly specified mode)
        if (existing.server && (useGit || parsed.flags.sqlite)) {
          warnings.push(`Repo uses server mode (${existing.server}), you're setting up git mode`);
        }
        if (!existing.server && serverUrl) {
          warnings.push(`Repo uses git mode, you're setting up server mode (${serverUrl})`);
        }

        // Server URL mismatch
        if (existing.server && serverUrl && existing.server !== serverUrl) {
          warnings.push(`Repo uses different server: ${existing.server}`);
        }

        // Backend mismatch (only for git mode)
        if (!existing.server && !serverUrl) {
          const existingBackend = existing.dataFile?.endsWith('.sqlite') ? 'sqlite' : 'json';
          const newBackend = useSqlite ? 'sqlite' : 'json';
          if (existingBackend !== newBackend) {
            warnings.push(`Repo uses ${existingBackend} backend, you're setting up ${newBackend}`);
          }
        }

        if (warnings.length > 0) {
          console.log(`\n${c.yellow}!${c.reset} Config mismatch detected:`);
          warnings.forEach(w => console.log(`  ${c.yellow}-${c.reset} ${w}`));
          console.log(`${c.dim}\nOther developers may not see your tasks if you proceed.${c.reset}`);

          if (parsed.flags.force === true) {
            console.log(`${c.dim}Proceeding due to --force flag.\n${c.reset}`);
          } else if (isInteractive()) {
            const answer = await prompt('\nOverwrite existing config? [y/N]: ');
            if (!answer.toLowerCase().startsWith('y')) {
              console.log('Aborted. Use existing config or remove .flux/ to start fresh.');
              process.exit(0);
            }
          } else {
            console.error('Use --force to overwrite existing config in non-interactive mode.');
            process.exit(1);
          }
        }
      } catch {
        // Ignore parse errors - will overwrite invalid config
      }
    }

    if (!serverUrl && !useGit && isNew && isInteractive()) {
      // Interactive mode for new init
      console.log(`${c.bold}Kenzo Setup${c.reset} ${c.dim}(Flux engine)${c.reset}\n`);
      console.log('Choose how to sync tasks:\n');
      console.log(`  ${c.cyan}1${c.reset}) ${c.bold}Git branches${c.reset} (default) - sync via flux-data branch`);
      console.log(`  ${c.cyan}2${c.reset}) ${c.bold}Server${c.reset} - connect to a Kenzo/Flux server\n`);

      const choice = await prompt('Choice [1]: ');

      if (choice === '2') {
        serverUrl = await prompt('Server URL: ');
        if (!serverUrl) {
          console.error('Server URL required');
          process.exit(1);
        }
        apiKey = await prompt('API Key (or $ENV_VAR, blank for none): ');
      }
    }

    // Write config
    const config: FluxConfig = {};
    if (serverUrl) config.server = serverUrl;
    if (apiKey) config.apiKey = apiKey;
    if (useSqlite) config.dataFile = 'data.sqlite';
    writeConfig(fluxDir, config);

    // Add .flux/ to .gitignore if not already present (at git root)
    const gitRoot = findGitRoot();
    const gitignorePath = gitRoot ? resolve(gitRoot, '.gitignore') : resolve(process.cwd(), '.gitignore');
    const gitignoreEntry = '.flux/';
    let gitignoreContent = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
    if (!gitignoreContent.split('\n').some(line => line.trim() === gitignoreEntry)) {
      const newline = gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n') ? '\n' : '';
      appendFileSync(gitignorePath, `${newline}${gitignoreEntry}\n`);
      console.log(`Added .flux/ to ${gitRoot ? gitignorePath : '.gitignore'}`);
    }

    // Create data file for git mode (server mode doesn't need it)
    if (!serverUrl && !existsSync(dataPath)) {
      if (useSqlite) {
        // SQLite adapter creates file automatically on first use
        const adapter = createAdapter(dataPath);
        setStorageAdapter(adapter);
        initStore();
      } else {
        writeFileSync(dataPath, JSON.stringify({ projects: [], epics: [], tasks: [] }, null, 2));
      }
    }

    if (isNew) {
      console.log(`Initialized .flux in ${fluxDir}`);
      if (serverUrl) {
        console.log(`Mode: server (${serverUrl})`);
      } else {
        console.log(`Mode: git (${useSqlite ? 'sqlite' : 'json'})`);
      }
    } else {
      console.log('.flux already initialized');
      if (serverUrl) {
        console.log(`Updated server: ${serverUrl}`);
      }
    }

    // Update agent instructions (interactive or skip with --no-agents)
    if (parsed.flags['no-agents'] !== true) {
      let updateAgents = true;
      if (isNew && isInteractive()) {
        const answer = await prompt('\nUpdate AGENTS.md with Flux instructions? [Y/n]: ');
        updateAgents = answer.toLowerCase() !== 'n';
      }
      if (updateAgents) {
        const agentFile = updateAgentInstructions();
        console.log(`Updated ${agentFile}`);
      }
    }

    // Project setup (interactive or --project flag)
    let projectId = parsed.flags.project as string | undefined;
    if (!projectId && isInteractive()) {
      // Initialize storage/client to fetch projects
      if (serverUrl) {
        initClient(serverUrl, apiKey);
      } else {
        const adapter = createAdapter(dataPath);
        setStorageAdapter(adapter);
        initStore();
        initClient();
      }

      const projects = await getProjects();
      if (projects.length === 0) {
        // No projects - create one
        const name = await prompt('\nProject name: ') || 'default';
        const project = await createProject(name);
        projectId = project.id;
        console.log(`Created project: ${project.name} (${project.id})`);
      } else if (projects.length === 1) {
        // Single project - auto-select
        projectId = projects[0].id;
        console.log(`Using project: ${projects[0].name} (${projects[0].id})`);
      } else {
        // Multiple projects - let user choose
        console.log('\nSelect a project:');
        projects.forEach((p, i) => console.log(`  ${c.cyan}${i + 1}${c.reset}) ${p.name} (${p.id})`));
        console.log(`  ${c.cyan}n${c.reset}) Create new project`);
        const choice = await prompt('Choice: ');
        if (choice === 'n') {
          const name = await prompt('Project name: ');
          if (name) {
            const project = await createProject(name);
            projectId = project.id;
            console.log(`Created project: ${project.name}`);
          }
        } else {
          const idx = parseInt(choice) - 1;
          if (idx >= 0 && idx < projects.length) {
            projectId = projects[idx].id;
          }
        }
      }

      // Save project to config
      if (projectId) {
        config.project = projectId;
        writeConfig(fluxDir, config);
      }
    }
    return;
  }

  // Handle git sync commands (before storage init)
  if (parsed.command === 'pull' || parsed.command === 'push') {
    const fluxDir = findFluxDir();
    loadEnvLocal(fluxDir);
    const config = readConfig(fluxDir);
    if (config.server) {
      console.error('pull/push not available in server mode - data syncs automatically');
      process.exit(1);
    }
    if (config.dataFile?.endsWith('.sqlite')) {
      console.error('pull/push requires JSON backend, not SQLite');
      console.error('Tip: Export with: flux export -o backup.json');
      process.exit(1);
    }
    const gitRoot = findGitRoot();
    if (!gitRoot) {
      console.error('Not in a git repository');
      process.exit(1);
    }

    const dataPath = resolve(fluxDir, 'data.json');

    if (parsed.command === 'pull') {
      try {
        const worktree = ensureWorktree(gitRoot);
        const worktreeData = resolve(worktree, '.flux', 'data.json');
        const worktreeBlobs = resolve(worktree, '.flux', 'blobs');
        const localBlobs = resolve(fluxDir, 'blobs');

        execSync('git fetch origin flux-data', { stdio: 'pipe', cwd: worktree });
        execSync('git reset --hard origin/flux-data', { stdio: 'pipe', cwd: worktree });

        if (existsSync(worktreeData)) {
          mkdirSync(fluxDir, { recursive: true });
          writeFileSync(dataPath, readFileSync(worktreeData, 'utf-8'));
          console.log('Pulled latest tasks from flux-data branch');
        } else {
          console.log('No .flux/data.json in flux-data branch yet');
        }
        // Copy blobs from worktree
        if (existsSync(worktreeBlobs)) {
          mkdirSync(localBlobs, { recursive: true });
          cpSync(worktreeBlobs, localBlobs, { recursive: true });
          console.log('Pulled blobs from flux-data branch');
        }
      } catch (e: any) {
        console.error('Failed to pull:', e.message);
        process.exit(1);
      }
    } else {
      const msg = parsed.subcommand || 'update tasks';
      if (!existsSync(dataPath)) {
        console.error(`No .flux/data.json found. Run: ${publicCommandName()} init`);
        process.exit(1);
      }

      try {
        const worktree = ensureWorktree(gitRoot);
        const worktreeFlux = resolve(worktree, '.flux');
        const worktreeData = resolve(worktreeFlux, 'data.json');
        const localBlobs = resolve(fluxDir, 'blobs');
        const worktreeBlobs = resolve(worktreeFlux, 'blobs');

        mkdirSync(worktreeFlux, { recursive: true });
        writeFileSync(worktreeData, readFileSync(dataPath, 'utf-8'));

        // Copy blobs to worktree
        if (existsSync(localBlobs)) {
          mkdirSync(worktreeBlobs, { recursive: true });
          cpSync(localBlobs, worktreeBlobs, { recursive: true });
        }

        execSync('git add .flux/data.json', { stdio: 'pipe', cwd: worktree });
        if (existsSync(worktreeBlobs)) {
          execSync('git add .flux/blobs', { stdio: 'pipe', cwd: worktree });
        }
        try {
          execSync(`git commit -m "flux: ${msg}"`, { stdio: 'pipe', cwd: worktree });
          execSync('git push origin flux-data', { stdio: 'pipe', cwd: worktree });
          console.log(`Pushed tasks to flux-data branch: "${msg}"`);
        } catch {
          console.log('No changes to push');
        }
      } catch (e: any) {
        console.error('Failed to push:', e.message);
        process.exit(1);
      }
    }
    return;
  }

  if (parsed.command === 'mcp') {
    printMcpSetup();
    return;
  }

  // dev/serve handle their own storage initialization.
  if (parsed.command === 'dev') {
    await launchKenzoApp();
    return;
  }

  if (parsed.command === 'serve') {
    if (publicCommandName() === 'kenzoboard') {
      await ensureKenzoWorkspace();
    }
    await serveCommand(parsed.args, parsed.flags, { defaultPort: defaultServePort(), open: parsed.flags.open === true });
    return;
  }

  // Handle prime gracefully (before storage init - should never fail for hooks)
  if (parsed.command === 'prime') {
    const fluxDir = findFluxDir();
    const configPath = resolve(fluxDir, 'config.json');

    // If not initialized, exit cleanly (no flux context to prime)
    if (!existsSync(configPath)) {
      return;
    }

    // Otherwise proceed with normal prime
    try {
      const storage = initStorage();
      await primeCommand(
        parsed.subcommand ? [parsed.subcommand, ...parsed.args] : parsed.args,
        parsed.flags,
        json,
        storage.project
      );
    } catch {
      // Swallow errors - prime should always succeed for hooks
    }
    return;
  }

  // Initialize storage for other commands
  let defaultProject: string | undefined;
  try {
    const storage = initStorage();
    defaultProject = storage.project;
  } catch (e) {
    console.error(`No .flux directory found. Run: ${publicCommandName()} init`);
    process.exit(1);
  }

  // Route commands
  switch (parsed.command) {
    case 'project':
      await projectCommand(parsed.subcommand, parsed.args, parsed.flags, json, defaultProject);
      break;
    case 'epic':
      await epicCommand(parsed.subcommand, parsed.args, parsed.flags, json);
      break;
    case 'task':
      await taskCommand(parsed.subcommand, parsed.args, parsed.flags, json, defaultProject);
      break;
    case 'ready':
      // ready doesn't have a subcommand, so subcommand IS the first arg
      await readyCommand(parsed.subcommand ? [parsed.subcommand, ...parsed.args] : parsed.args, parsed.flags, json);
      break;
    case 'show':
      // show doesn't have a subcommand, so subcommand IS the task ID
      await showCommand(parsed.subcommand ? [parsed.subcommand, ...parsed.args] : parsed.args, parsed.flags, json);
      break;
    case 'auth':
      await authCommand(parsed.subcommand, parsed.args, parsed.flags, json);
      break;
    case 'blob':
      await blobCommand(parsed.subcommand, parsed.args, parsed.flags, json);
      break;
    case 'export': {
      const data = await exportAll();
      const output = JSON.stringify(data, null, 2);
      const outFile = parsed.flags.o as string || parsed.flags.output as string;
      if (outFile) {
        writeFileSync(outFile, output);
        console.log(`Exported to ${outFile}`);
      } else {
        console.log(output);
      }
      break;
    }
    case 'import': {
      const file = parsed.subcommand;
      if (!file) {
        console.error(`Usage: ${publicCommandName()} import <file> [--merge]`);
        process.exit(1);
      }
      let content: string;
      if (file === '-') {
        // Read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString('utf-8');
      } else {
        if (!existsSync(file)) {
          console.error(`File not found: ${file}`);
          process.exit(1);
        }
        content = readFileSync(file, 'utf-8');
      }
      const data = JSON.parse(content);
      const merge = parsed.flags.merge === true;
      await importAll(data, merge);
      const action = merge ? 'Merged' : 'Imported';
      console.log(`${action} ${data.projects?.length || 0} projects, ${data.epics?.length || 0} epics, ${data.tasks?.length || 0} tasks`);
      break;
    }
    case 'doctor': {
      await doctorCommand(parsed.flags);
      break;
    }
    case 'help':
    default: {
      const command = publicCommandName();
      const compat = command === 'kenzoboard'
        ? `\n${c.bold}Compatibility:${c.reset}\n  ${c.cyan}flux ready${c.reset}, ${c.cyan}flux task create ...${c.reset}, and other Flux engine commands still work.\n`
        : '';
      console.log(`${c.cyan}${c.bold}Kenzo${c.reset} ${c.dim}- local-first board for human-led AI work${c.reset}
${c.dim}Powered by the Flux engine for CLI, MCP, sync, storage, and APIs.${c.reset}

${c.bold}Start:${c.reset}
  ${c.cyan}${command}${c.reset}                              Create/open a local workspace and start Kenzo
  ${c.cyan}${command} init${c.reset} ${c.green}[--server URL] [--api-key KEY] [--sqlite] [--git] [--force]${c.reset}
  ${c.cyan}${command} dev${c.reset} ${c.green}[--open]${c.reset}                 Start the local Kenzo app on port ${defaultServePort()}
  ${c.cyan}${command} serve${c.reset} ${c.green}[-p port] [--data file] [--open]${c.reset}
  ${c.cyan}${command} mcp${c.reset}                         Show Codex/Claude MCP setup commands

${c.bold}Ready Work:${c.reset}
  ${c.cyan}${command} ready${c.reset} ${c.green}[--json]${c.reset}               Show unblocked tasks sorted by priority
  ${c.cyan}${command} show${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--json]${c.reset}           Show task details with comments
  ${c.cyan}${command} prime${c.reset} ${c.green}[--mcp] [--full]${c.reset}       Output workflow context for AI hooks

${c.bold}Projects:${c.reset}
  ${c.cyan}${command} project list${c.reset} ${c.green}[--json]${c.reset}        List all projects (* = current)
  ${c.cyan}${command} project use${c.reset} ${c.yellow}<id>${c.reset}             Set default project
  ${c.cyan}${command} project create${c.reset} ${c.yellow}<name>${c.reset} ${c.green}[--private]${c.reset}
  ${c.cyan}${command} project update${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--name] [--desc] [--private|--public]${c.reset}
  ${c.cyan}${command} project delete${c.reset} ${c.yellow}<id>${c.reset}

${c.bold}Tasks:${c.reset}
  ${c.cyan}${command} task list${c.reset} ${c.green}[project] [--json] [--epic] [--status]${c.reset}
  ${c.cyan}${command} task create${c.reset} ${c.green}[project]${c.reset} ${c.yellow}<title>${c.reset} ${c.green}[-P 0|1|2] [-e epic] [--ac ...] [--guardrail ...]${c.reset}
  ${c.cyan}${command} task update${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--title] [--status] [--note] [--epic] [--blocked] [--ac ...] [--guardrail ...]${c.reset}
  ${c.cyan}${command} task start${c.reset} ${c.yellow}<id>${c.reset}
  ${c.cyan}${command} task done${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--note]${c.reset}

${c.bold}Epics:${c.reset}
  ${c.cyan}${command} epic list${c.reset} ${c.yellow}<project>${c.reset} ${c.green}[--json]${c.reset}
  ${c.cyan}${command} epic create${c.reset} ${c.yellow}<project> <title>${c.reset}
  ${c.cyan}${command} epic update${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--title] [--status] [--note]${c.reset}
  ${c.cyan}${command} epic delete${c.reset} ${c.yellow}<id>${c.reset}

${c.bold}Blobs:${c.reset}
  ${c.cyan}${command} blob attach${c.reset} ${c.yellow}<task-id> <file>${c.reset}
  ${c.cyan}${command} blob get${c.reset} ${c.yellow}<blob-id>${c.reset} ${c.green}[path]${c.reset}
  ${c.cyan}${command} blob list${c.reset} ${c.green}[--task <id>]${c.reset}
  ${c.cyan}${command} blob delete${c.reset} ${c.yellow}<blob-id>${c.reset}

${c.bold}Data:${c.reset}
  ${c.cyan}${command} export${c.reset} ${c.green}[-o file]${c.reset}
  ${c.cyan}${command} import${c.reset} ${c.yellow}<file>${c.reset} ${c.green}[--merge]${c.reset}
  ${c.cyan}${command} doctor${c.reset} ${c.green}[--fix]${c.reset}

${c.bold}Sync:${c.reset} ${c.dim}(Flux engine compatibility via flux-data branch)${c.reset}
  ${c.cyan}${command} pull${c.reset}
  ${c.cyan}${command} push${c.reset} ${c.yellow}[message]${c.reset}

${c.bold}Auth:${c.reset} ${c.dim}(server mode only)${c.reset}
  ${c.cyan}${command} auth${c.reset}
  ${c.cyan}${command} auth create-key${c.reset} ${c.green}--name NAME [-p PROJECT]${c.reset}
  ${c.cyan}${command} auth list-keys${c.reset}
  ${c.cyan}${command} auth revoke${c.reset} ${c.yellow}<id>${c.reset}
  ${c.cyan}${command} auth status${c.reset}

${c.bold}Flags:${c.reset}
  ${c.green}--json${c.reset}                            Output as JSON
  ${c.green}--force${c.reset}                           Overwrite config without prompting (init)
  ${c.green}-P, --priority${c.reset}                    Priority (0=P0, 1=P1, 2=P2)
  ${c.green}-e, --epic${c.reset}                        Epic ID
  ${c.green}--blocked${c.reset}                         External blocker ("reason" or "clear")
  ${c.green}--ac${c.reset}                              Acceptance criterion (repeatable)
  ${c.green}--guardrail${c.reset}                       Guardrail as "999:text" (repeatable)
  ${c.green}--data${c.reset}                            Data file path (serve command)
${compat}`);
      break;
    }
  }
}

if (isCliEntrypoint()) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
