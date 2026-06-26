const configuredApiOrigin = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/$/, "");

export const API_ORIGIN = configuredApiOrigin || (import.meta.env.DEV ? "http://localhost:3000" : "");
export const API_BASE = `${API_ORIGIN}/api`;
export const EVENTS_URL = `${API_BASE}/events`;
export const VERSION_URL = `${API_ORIGIN}/version`;
