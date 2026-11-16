// Device-local preferences (never synced): API keys, tokens, UI state.
// Wrapped in try/catch because storage can be unavailable (private mode, blocked site data).

export function lsGet(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  geminiKey: 'nutricion.geminiKey',
  geminiModel: 'nutricion.geminiModel',
  ghToken: 'nutricion.ghToken',
  gistId: 'nutricion.gistId',
  lastSync: 'nutricion.lastSync',
  ocrLang: 'nutricion.ocrLang',
};

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
