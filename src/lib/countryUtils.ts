/**
 * Converts 2-letter ISO country code (e.g. CZ, DE) to flag emoji (🇨🇿, 🇩🇪).
 * Returns the original string if not a valid 2-letter code.
 */
export function countryCodeToFlag(code: string): string | null {
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Za-z]{2}$/.test(trimmed)) return null;
  return trimmed
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('');
}
