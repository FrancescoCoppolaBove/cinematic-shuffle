import { useState, useEffect } from 'react';
import { Shuffle, Search, Eye, Film, X, CheckCircle } from 'lucide-react';
import type { AppView } from './types';
import { useAuth } from './hooks/useAuth';
import { useWatched } from './hooks/useWatched';
import { ShuffleView } from './components/ShuffleView';
import { SearchView } from './components/SearchView';
import { WatchedView } from './components/WatchedView';
import { ApiKeySetup } from './components/ApiKeySetup';
import { LoginButton } from './components/LoginButton';
import { cn } from './utils';

function hasApiKey(): boolean {
  const envKey = import.meta.env.VITE_TMDB_API_KEY;
  if (envKey && envKey !== 'la_tua_tmdb_api_key_qui' && envKey.length > 10) return true;
  const runtimeKey = localStorage.getItem('tmdb_runtime_key');
  return !!(runtimeKey && runtimeKey.length > 10);
}

const NAV_ITEMS: { view: AppView; icon: typeof Shuffle; label: string }[] = [
  { view: 'shuffle', icon: Shuffle, label: 'Shuffle' },
  { view: 'search', icon: Search, label: 'Cerca' },
  { view: 'watched', icon: Eye, label: 'Visti' },
];

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'info';
}

export default function App() {
  const [apiKeyReady, setApiKeyReady] = useState(hasApiKey);
  const [view, setView] = useState<AppView>('shuffle');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { user, loading: authLoading, error: authError, signInWithGoogle, signOut, isConfigured } = useAuth();
  const {
    watchedMovies, watchedIds, loading: watchedLoading, migratedCount,
    markWatched, unmarkWatched, updateRating,
  } = useWatched(user);

  // Toast helper
  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }

  // Banner migrazione
  useEffect(() => {
    if (migratedCount && migratedCount > 0) {
      showToast(`${migratedCount} film migrati dal browser al tuo account ✓`, 'success');
    }
  }, [migratedCount]);

  // Toast benvenuto al login
  useEffect(() => {
    if (user && !authLoading) {
      const name = user.displayName?.split(' ')[0] || 'back';
      showToast(`Bentornato, ${name}!`, 'info');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Toast errore auth
  useEffect(() => {
    if (authError) showToast(authError, 'info');
  }, [authError]);

  function getPersonalRating(id: number) {
    return watchedMovies.find(m => m.id === id)?.personal_rating ?? null;
  }

  if (!apiKeyReady) {
    return <ApiKeySetup onSave={() => setApiKeyReady(true)} />;
  }

  return (
    <div className="min-h-screen bg-film-black text-film-text">
      {/* Grain overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-30 bg-grain z-50" />

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl text-sm shadow-xl animate-slide-up pointer-events-auto',
              t.type === 'success'
                ? 'bg-film-surface border border-film-accent/40 text-film-text'
                : 'bg-film-surface border border-film-border text-film-muted'
            )}
          >
            {t.type === 'success' && <CheckCircle size={14} className="text-film-accent shrink-0" />}
            <span>{t.message}</span>
            <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} className="ml-1 text-film-subtle hover:text-film-text">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-film-border bg-film-black/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Film size={18} className="text-film-accent" />
            <span className="font-display text-lg tracking-[0.2em] text-film-text">CINEMATIC</span>
            <span className="font-display text-lg tracking-[0.2em] text-film-accent">SHUFFLE</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Film visti counter */}
            {watchedMovies.length > 0 && (
              <div className="text-film-subtle text-xs flex items-center gap-1.5">
                {watchedLoading
                  ? <div className="w-3 h-3 border border-film-subtle border-t-transparent rounded-full animate-spin" />
                  : <Eye size={12} />
                }
                <span>{watchedMovies.length}</span>
              </div>
            )}

            {/* Login button */}
            <LoginButton
              user={user}
              loading={authLoading}
              onSignIn={signInWithGoogle}
              onSignOut={signOut}
              isConfigured={isConfigured}
            />
          </div>
        </div>

        {/* Banner "non loggato" — solo se Firebase è configurato */}
        {isConfigured && !user && !authLoading && (
          <div className="border-t border-film-border bg-film-surface/50">
            <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
              <p className="text-film-subtle text-xs">
                Accedi con Google per sincronizzare i tuoi film visti su tutti i dispositivi
              </p>
              <button
                onClick={signInWithGoogle}
                className="text-film-accent text-xs font-medium hover:underline shrink-0"
              >
                Accedi →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        {view === 'shuffle' && (
          <ShuffleView
            watchedIds={watchedIds}
            getPersonalRating={getPersonalRating}
            onMarkWatched={markWatched}
            onUnmarkWatched={unmarkWatched}
            onUpdateRating={updateRating}
          />
        )}
        {view === 'search' && (
          <SearchView
            watchedIds={watchedIds}
            getPersonalRating={getPersonalRating}
            onMarkWatched={markWatched}
            onUnmarkWatched={unmarkWatched}
            onUpdateRating={updateRating}
          />
        )}
        {view === 'watched' && (
          <WatchedView
            watchedMovies={watchedMovies}
            watchedIds={watchedIds}
            loading={watchedLoading}
            onMarkWatched={markWatched}
            onUnmarkWatched={unmarkWatched}
            onUpdateRating={updateRating}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-film-border bg-film-black/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 flex">
          {NAV_ITEMS.map(({ view: v, icon: Icon, label }) => {
            const active = view === v;
            const badge = v === 'watched' && watchedMovies.length > 0 ? watchedMovies.length : null;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3.5 transition-all relative',
                  active ? 'text-film-accent' : 'text-film-subtle hover:text-film-muted'
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-film-accent rounded-full" />
                )}
                <div className="relative">
                  <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                  {badge && !active && (
                    <span className="absolute -top-1.5 -right-2 bg-film-accent text-film-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-widest font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
