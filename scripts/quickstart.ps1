$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is required. Install Docker Desktop: https://www.docker.com/get-started"
  exit 1
}

$Image = "sirsjg/flux-mcp:latest"

Write-Host "Pulling Kenzo image (powered by the Flux engine)..."
docker pull $Image

Write-Host "Starting Kenzo web/API..."
if (docker ps -a --format '{{.Names}}' | Select-String -Quiet '^flux-web$') {
  docker rm -f flux-web | Out-Null
}
docker run -d -p 3000:3000 -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite --name flux-web $Image bun packages/server/dist/index.js

Write-Host ""
Write-Host "Kenzo is running: http://localhost:3000"
Write-Host ""
Write-Host "Starting MCP server for Claude/Codex..."
Write-Host "Press Ctrl+C to stop the MCP server"
Write-Host ""
docker run -i --rm -v flux-data:/app/packages/data -e FLUX_DATA=/app/packages/data/flux.sqlite $Image bun packages/mcp/dist/index.js
