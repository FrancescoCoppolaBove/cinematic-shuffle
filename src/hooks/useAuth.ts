import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
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

    // Sul native il sign-in avviene via redirect: al rientro nell'app
    // completiamo il flusso leggendo l'esito. Su web è un no-op innocuo.
    getRedirectResult(auth).catch(err => {
      setState(s => ({ ...s, loading: false, error: err?.message ?? null }));
    });

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
      // Nelle WebView native (iOS/Android via Capacitor) il popup OAuth non
      // funziona: usiamo il redirect, completato da getRedirectResult al
      // ritorno. Su web teniamo il popup (UX migliore, niente full reload).
      if (Capacitor.isNativePlatform()) {
        await signInWithRedirect(auth, googleProvider);
        return; // la pagina farà redirect; lo stato si aggiorna al rientro
      }
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged aggiornerà lo stato automaticamente
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in error';
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
