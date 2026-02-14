import { useState, useEffect } from 'react';

/**
 * Currency utilities – CZK/EUR/USD support with conversion to CZK.
 * Uses Frankfurter API when available, fallback to approximate rates.
 */

export const CURRENCIES = ['CZK', 'EUR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

// Fallback rates (approximate) when API is unavailable
const FALLBACK_RATES: Record<string, number> = {
  EUR: 25,
  USD: 23,
};

let cachedRates: Record<string, number> = { ...FALLBACK_RATES };
let lastFetch = 0;
const CACHE_MS = 60 * 60 * 1000; // 1 hour

/** AbortSignal with timeout – polyfill for older Electron/Chromium */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=CZK',
      { signal: timeoutSignal(5000) }
    );
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    if (data.rates?.CZK) cachedRates.EUR = data.rates.CZK;
  } catch {
    // keep fallback
  }

  try {
    const res = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CZK',
      { signal: timeoutSignal(5000) }
    );
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    if (data.rates?.CZK) cachedRates.USD = data.rates.CZK;
  } catch {
    // keep fallback
  }

  lastFetch = Date.now();
  return { ...cachedRates };
}

export function getRates(): Record<string, number> {
  return { ...cachedRates };
}

/** Convert amount to CZK. Returns amount unchanged if currency is CZK. */
export function convertToCzk(amount: number, currency: string): number {
  if (!currency || currency === 'CZK') return amount;
  const rate = cachedRates[currency] ?? FALLBACK_RATES[currency] ?? 1;
  return amount * rate;
}

/** Format price with optional CZK conversion. */
export function formatPriceWithCzk(
  amount: number,
  currency: string,
  unit?: string,
  showCzkWhenNotCzk = true
): { primary: string; czk?: string } {
  const primary = `${amount.toFixed(2)} ${currency}${unit ? `/${unit}` : ''}`;
  const czk =
    showCzkWhenNotCzk &&
    currency !== 'CZK' &&
    (CURRENCIES as readonly string[]).includes(currency)
      ? `${convertToCzk(amount, currency).toFixed(2)} CZK${unit ? `/${unit}` : ''}`
      : undefined;
  return { primary, czk };
}

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>(getRates);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Date.now() - lastFetch < CACHE_MS) return;
    setLoading(true);
    fetchExchangeRates()
      .then(setRates)
      .finally(() => setLoading(false));
  }, []);

  return { rates, loading, convertToCzk };
}
