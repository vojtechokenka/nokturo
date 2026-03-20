import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };
    update(mediaQuery);
    const handler = (event: MediaQueryListEvent) => update(event);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
