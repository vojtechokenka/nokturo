import { useSleepModeStore } from '../stores/sleepModeStore';

/**
 * Checks whether an error looks like a session / network problem and
 * activates Sleep Mode when appropriate.
 *
 * Returns `true` if sleep mode was activated (caller can skip further handling).
 */
export function handleApiError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : '';

  const isSessionError =
    /JWT expired/i.test(msg) ||
    /invalid.*token/i.test(msg) ||
    /refresh_token_not_found/i.test(msg);

  const isNetworkError =
    /Failed to fetch/i.test(msg) ||
    /NetworkError/i.test(msg) ||
    /network request failed/i.test(msg) ||
    /Load failed/i.test(msg);

  if (isSessionError) {
    useSleepModeStore.getState().activate('Your session expired');
    return true;
  }

  if (isNetworkError) {
    useSleepModeStore.getState().activate('Connection lost');
    return true;
  }

  return false;
}
