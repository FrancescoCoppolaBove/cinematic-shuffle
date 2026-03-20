/**
 * useUserPreferences — gestisce le preferenze utente (piattaforme preferite).
 * Persiste su Firestore, con cache locale in useState.
 */
import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { fetchUserPreferences, saveUserPreferences, type UserPreferences } from '../services/firestore';

export function useUserPreferences(user: User | null) {
  const [prefs, setPrefs] = useState<UserPreferences>({ favoriteProviderIds: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPrefs({ favoriteProviderIds: [] }); setLoading(false); return; }
    fetchUserPreferences(user.uid)
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const updateProviders = useCallback(async (ids: number[]) => {
    if (!user) return;
    const updated = { ...prefs, favoriteProviderIds: ids };
    setPrefs(updated); // optimistic
    await saveUserPreferences(user.uid, updated);
  }, [user, prefs]);

  return { prefs, loading, updateProviders };
}
