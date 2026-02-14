/** Noop storage when real storage is unavailable (cleared, disabled, or throws) */
const noopStorage: Storage = {
  get length() {
    return 0;
  },
  key: () => null,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

function isLocalhost(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const h = window.location?.hostname ?? '';
    return h === '127.0.0.1' || h === 'localhost' || h === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Returns localStorage or sessionStorage, or a noop when unavailable.
 * On localhost (127.0.0.1), always uses window.localStorage/sessionStorage.
 */
export function safeGetStorage(type: 'local' | 'session'): Storage {
  if (isLocalhost()) {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  }
  try {
    const s = type === 'local' ? localStorage : sessionStorage;
    return s ?? noopStorage;
  } catch {
    return noopStorage;
  }
}
