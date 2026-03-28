import { useCallback, useEffect, useMemo, useState } from 'react';

type EditMode = 'view' | 'edit';

interface UsePersistedEditModeOptions {
  storageKey: string;
  canEdit: boolean;
  getScrollElement?: () => HTMLElement | null;
}

function readMode(storageKey: string): EditMode {
  if (typeof window === 'undefined') return 'view';
  const stored = window.sessionStorage.getItem(storageKey);
  if (stored === 'edit') return 'edit';
  return 'view';
}

export function usePersistedEditMode({
  storageKey,
  canEdit,
  getScrollElement,
}: UsePersistedEditModeOptions) {
  const scrollKey = useMemo(() => `${storageKey}:scrollTop`, [storageKey]);
  const [mode, setMode] = useState<EditMode>(() => readMode(storageKey));

  const getCurrentScrollElement = useCallback(() => {
    if (getScrollElement) return getScrollElement();
    return (document.querySelector('[data-scroll-container]') as HTMLElement | null) ?? null;
  }, [getScrollElement]);

  const saveScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const element = getCurrentScrollElement();
    const scrollTop = element ? element.scrollTop : window.scrollY;
    window.sessionStorage.setItem(scrollKey, String(scrollTop));
  }, [getCurrentScrollElement, scrollKey]);

  const restoreScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(scrollKey);
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;

    const apply = () => {
      const element = getCurrentScrollElement();
      if (element) element.scrollTop = value;
      else window.scrollTo(0, value);
    };

    window.requestAnimationFrame(() => {
      apply();
      window.setTimeout(apply, 80);
    });
  }, [getCurrentScrollElement, scrollKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mode === 'edit') {
      window.sessionStorage.setItem(storageKey, 'edit');
    }
  }, [mode, storageKey]);

  useEffect(() => {
    if (!canEdit && mode === 'edit') {
      setMode('view');
    }
  }, [canEdit, mode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!canEdit || mode !== 'view') return;
    if (window.sessionStorage.getItem(storageKey) !== 'edit') return;
    setMode('edit');
    restoreScrollPosition();
  }, [canEdit, mode, restoreScrollPosition, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeUnload = () => saveScrollPosition();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      saveScrollPosition();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [saveScrollPosition]);

  const clearPersistedEditState = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(scrollKey);
  }, [scrollKey, storageKey]);

  const exitEditMode = useCallback(() => {
    clearPersistedEditState();
    setMode('view');
  }, [clearPersistedEditState]);

  return { mode, setMode, saveScrollPosition, clearPersistedEditState, exitEditMode };
}
