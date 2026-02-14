/**
 * Platform detection utilities.
 *
 * Detects whether the app is running inside Electron (desktop) or
 * in a regular browser (web / mobile).
 */

export const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;

  // The Electron preload script exposes `window.electronAPI.isElectron = true`
  // via contextBridge — this is the most reliable check.
  return !!window.electronAPI?.isElectron;
};

export const isWeb = (): boolean => {
  return !isElectron();
};

export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator.userAgent,
  );
};

export const getPlatform = (): 'electron' | 'web' | 'mobile' => {
  if (isElectron()) return 'electron';
  if (isMobile()) return 'mobile';
  return 'web';
};
