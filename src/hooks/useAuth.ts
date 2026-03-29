import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';
import { upsertUserPublicProfile } from '../services/firestore';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: isFirebaseConfigured(), // loading solo se Firebase è configurato
    error: null,
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsub = onAuthStateChanged(
      auth,
      user => {
        setState({ user, loading: false, error: null });
        if (user) {
          // Ensure public profile exists/is updated on every login
          upsertUserPublicProfile(user.uid, {
            displayName: user.displayName ?? 'User',
            photoURL: user.photoURL ?? null,
          }).catch(() => {});
        }
      },
      err => setState({ user: null, loading: false, error: err.message })
    );
    return unsub;
  }, []);

  async function signInWithGoogle() {
    if (!isFirebaseConfigured()) return;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged aggiornerà lo stato automaticamente
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore di accesso';
      // Ignora l'errore se l'utente ha chiuso il popup
      if ((err as { code?: string }).code === 'auth/popup-closed-by-user') {
        setState(s => ({ ...s, loading: false, error: null }));
        return;
      }
      setState(s => ({ ...s, loading: false, error: message }));
    }
  }

  async function signOutUser() {
    if (!isFirebaseConfigured()) return;
    await signOut(auth);
  }

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signInWithGoogle,
    signOut: signOutUser,
    isConfigured: isFirebaseConfigured(),
  };
}
