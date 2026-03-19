import { useState, useCallback } from 'react';

export interface PlaylistItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
}

export interface NavEntry {
  type: 'movie';
  id: number;
  mediaType: 'movie' | 'tv';
  fromLabel: string;
  // Playlist context — se aperto da una lista, contiene tutti i film della lista
  playlist?: PlaylistItem[];
  playlistIndex?: number; // index corrente nella playlist
}

export function useNavigationStack() {
  const [stack, setStack] = useState<NavEntry[]>([]);

  const current = stack[stack.length - 1] ?? null;
  const isOpen = stack.length > 0;

  const push = useCallback((entry: NavEntry) => {
    setStack(prev => [...prev, entry]);
  }, []);

  const pop = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  const replace = useCallback((entry: NavEntry) => {
    setStack([entry]);
  }, []);

  // Update the playlist index of the top entry (for swipe navigation)
  const updatePlaylistIndex = useCallback((newIndex: number) => {
    setStack(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], playlistIndex: newIndex };
      return updated;
    });
  }, []);

  return { stack, current, isOpen, push, pop, clear, replace, updatePlaylistIndex };
}
