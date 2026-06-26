import type { StorageAdapter } from '../store.js';
import { createJsonAdapter } from './json-adapter.js';

export { createJsonAdapter } from './json-adapter.js';

// Lazy-loaded SQLite adapter (requires Bun runtime)
let _createSqliteAdapter: ((filePath: string) => StorageAdapter) | undefined;

if ('Bun' in globalThis) {
  try {
    const runtimeImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{
      createSqliteAdapter: (filePath: string) => StorageAdapter;
    }>;
    const mod = await runtimeImport('./sqlite-adapter.js');
    _createSqliteAdapter = mod.createSqliteAdapter;
  } catch {
    // SQLite adapter not available in this build.
  }
}

/**
 * Create a SQLite storage adapter.
 * Requires Bun runtime (uses bun:sqlite).
 */
export function createSqliteAdapter(filePath: string): StorageAdapter {
  if (!_createSqliteAdapter) {
    throw new Error('SQLite adapter requires Bun runtime');
  }
  return _createSqliteAdapter(filePath);
}

/**
 * Create a storage adapter based on file extension.
 * - .sqlite or .db → SQLite adapter (requires Bun)
 * - .json or anything else → JSON adapter
 */
export function createAdapter(filePath: string): StorageAdapter {
  if (filePath.endsWith('.sqlite') || filePath.endsWith('.db')) {
    return createSqliteAdapter(filePath);
  }
  return createJsonAdapter(filePath);
}
