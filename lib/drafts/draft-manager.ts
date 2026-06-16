// Runs only in the browser — safe to import in 'use client' components.

interface DraftMeta {
  savedAt:   number;
  maxAgeMs:  number;
  formId:    string;
}

interface Draft<T> {
  data: T;
  meta: DraftMeta;
}

const PREFIX = 'sw:draft:';

const safe = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set: (key: string, value: string): void => {
    try { localStorage.setItem(key, value) } catch {}
  },
  del: (key: string): void => {
    try { localStorage.removeItem(key) } catch {}
  },
};

export const draftManager = {
  save<T>(formId: string, data: T, maxAgeMs: number): void {
    const draft: Draft<T> = {
      data,
      meta: { savedAt: Date.now(), maxAgeMs, formId },
    };
    safe.set(PREFIX + formId, JSON.stringify(draft));
  },

  load<T>(formId: string): T | null {
    const raw = safe.get(PREFIX + formId);
    if (!raw) return null;
    try {
      const draft: Draft<T> = JSON.parse(raw);
      if (Date.now() - draft.meta.savedAt > draft.meta.maxAgeMs) {
        safe.del(PREFIX + formId);
        return null;
      }
      return draft.data;
    } catch {
      safe.del(PREFIX + formId);
      return null;
    }
  },

  discard(formId: string): void {
    safe.del(PREFIX + formId);
  },

  exists(formId: string): boolean {
    const raw = safe.get(PREFIX + formId);
    if (!raw) return false;
    try {
      const draft: Draft<unknown> = JSON.parse(raw);
      return Date.now() - draft.meta.savedAt < draft.meta.maxAgeMs;
    } catch {
      return false;
    }
  },

  // Call on app init to remove stale entries without blocking the main thread.
  purgeExpired(): void {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((key) => {
          const raw = safe.get(key);
          if (!raw) return;
          try {
            const draft: Draft<unknown> = JSON.parse(raw);
            if (Date.now() - draft.meta.savedAt > draft.meta.maxAgeMs) {
              safe.del(key);
            }
          } catch {
            safe.del(key);
          }
        });
    } catch {}
  },
};
