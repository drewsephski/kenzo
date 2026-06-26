import { execSync, spawnSync } from 'node:child_process'

const resolveSha = () => {
  if (process.env.BUILD_SHA) return process.env.BUILD_SHA
  if (process.env.GIT_SHA) return process.env.GIT_SHA
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const buildSha = resolveSha()
const buildTime = process.env.BUILD_TIME?.trim() || new Date().toISOString()

const sharedResult = spawnSync('bun', ['run', '--filter', '@flux/shared', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, BUILD_SHA: buildSha, BUILD_TIME: buildTime },
})

const webResult = sharedResult.status === 0
  ? spawnSync('bun', ['run', '--filter', '@flux/web', 'build'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      BUILD_SHA: buildSha,
      BUILD_TIME: buildTime,
    },
  })
  : sharedResult

if (webResult.status !== 0) {
  process.exit(webResult.status ?? 1)
}

for (const workspace of ['@flux/server', '@flux/mcp', 'kenzoboard']) {
  const result = spawnSync('bun', ['run', '--filter', workspace, 'build', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      BUILD_SHA: buildSha,
      BUILD_TIME: buildTime,
      KENZO_WEB_BUILT: '1',
    },
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
