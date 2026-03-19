import { useState, useCallback } from 'react';

export interface NavEntry {
  type: 'movie';
  id: number;
  mediaType: 'movie' | 'tv';
  fromLabel: string; // label for back button, e.g. "Home", "Shuffle", "Watchlist"
}

export function useNavigationStack() {
  const [stack, setStack] = useState<NavEntry[]>([]);

  const current = stack[stack.length - 1] ?? null;

  const push = useCallback((entry: NavEntry) => {
    setStack(prev => [...prev, entry]);
  }, []);

  const pop = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  // Replace the whole stack with a single entry (when navigating from main views)
  const replace = useCallback((entry: NavEntry) => {
    setStack([entry]);
  }, []);

  const isOpen = stack.length > 0;

  return { stack, current, isOpen, push, pop, clear, replace };
}
