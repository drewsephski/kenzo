# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] - 2026-06-26

### Fixed
- `kenzoboard connect codex` now starts the configured MCP server and verifies Kenzo task tools before reporting success.

## [0.1.4] - 2026-06-26

### Added
- Added `kenzoboard connect codex` to configure and verify the Codex MCP server for the current workspace.

### Changed
- Made MCP mutation tool responses structured JSON so agents can reliably consume created and updated IDs.
- Updated first-run and setup docs to prefer the one-step Codex connector.

## [0.1.3] - 2026-06-26

### Fixed
- Improved `npx kenzoboard` launch output with a shorter Codex setup path.
- Added `FLUX_DIR` to Codex and Claude MCP setup commands so agents read the same board as the app.

## [0.1.1] - 2026-01-13

### Added
- Initial npm release as `flux-tasks`
- CLI with full MCP parity (`flux ready`, `flux task`, etc.)
- Git-native sync via `flux-data` branch
- Task dependencies and blocking indicators
- Priority system (P0/P1/P2)
- Agent memory via task comments
