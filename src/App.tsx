import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Shuffle, Search, Eye, Bookmark, X, CheckCircle } from 'lucide-react';
import type { AppView } from './types';
import { useAuth } from './hooks/useAuth';
import { useWatched } from './hooks/useWatched';
import { HomeView } from './components/HomeView';
import { ShuffleView } from './components/ShuffleView';
import { SearchView } from './components/SearchView';
import { WatchedView } from './components/WatchedView';
import { WatchlistView } from './components/WatchlistView';
import { ProfileView } from './components/ProfileView';
import { cn } from './utils';

// ─── Login screen ────────────────────────────────────────────────────────────

function LoginScreen({ onSignIn, loading, error }: { onSignIn: () => void; loading: boolean; error: string | null }) {
  return (
    <div className="min-h-screen bg-film-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-7xl mb-6 select-none">🎬</div>
          <h1 className="font-display text-5xl text-film-text tracking-[0.2em]">CINEMATIC</h1>
          <h2 className="font-display text-5xl text-film-accent tracking-[0.2em]">SHUFFLE</h2>
          <p className="text-film-muted text-sm pt-2">Scopri il tuo prossimo film o serie TV</p>
        </div>

        <div className="bg-film-surface border border-film-border rounded-2xl p-6 space-y-5">
          <div className="space-y-2 text-center">
            <p className="text-film-text text-sm font-medium">Accedi per continuare</p>
            <p className="text-film-subtle text-xs">
              Il tuo profilo, i film visti e la watchlist vengono sincronizzati su tutti i tuoi dispositivi
            </p>
          </div>

          <button onClick={onSignIn} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-white hover:bg-gray-100 text-gray-800 rounded-xl font-medium text-sm transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-60">
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Accesso in corso...' : 'Accedi con Google'}
          </button>

          {error && <p className="text-film-red text-xs text-center">{error}</p>}
        </div>

        <p className="text-film-subtle text-xs text-center">
          I tuoi dati sono privati e accessibili solo a te
        </p>
      </div>
    </div>
  );
}

// ─── Nav items ───────────────────────────────────────────────────────────────

const NAV: { view: AppView; icon: typeof Shuffle; label: string }[] = [
  { view: 'home',      icon: TrendingUp, label: 'Home'      },
  { view: 'shuffle',   icon: Shuffle,    label: 'Shuffle'   },
  { view: 'search',    icon: Search,     label: 'Cerca'     },
  { view: 'watchlist', icon: Bookmark,   label: 'Watchlist' },
  { view: 'watched',   icon: Eye,        label: 'Visti'     },
];

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'info' }

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { user, loading: authLoading, error: authError, signInWithGoogle, signOut } = useAuth();
  const {
    watchedMovies, watchedIds, watchlist, watchlistIds, loading: watchedLoading,
    markWatched, unmarkWatched, updateRating,
    addToWatchlist, removeFromWatchlist,
  } = useWatched(user);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => { if (authError) showToast(authError, 'info'); }, [authError, showToast]);
  useEffect(() => {
    if (user && !authLoading) showToast(`Bentornato, ${user.displayName?.split(' ')[0] || 'back'}!`, 'info');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const getPersonalRating = useCallback((id: number) =>
    watchedMovies.find(m => m.id === id)?.personal_rating ?? null, [watchedMovies]);

  // Shared props for all views
  const sharedProps = {
    watchedIds, watchlistIds, watchedMovies,
    getPersonalRating,
    onMarkWatched: markWatched,
    onUnmarkWatched: unmarkWatched,
    onUpdateRating: updateRating,
    onAddToWatchlist: addToWatchlist,
    onRemoveFromWatchlist: removeFromWatchlist,
  };

  // Show loading screen while auth resolves
  if (authLoading) {
    return (
      <div className="min-h-screen bg-film-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl select-none">🎬</div>
          <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Force login — no guest mode
  if (!user) {
    return <LoginScreen onSignIn={signInWithGoogle} loading={authLoading} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-film-black text-film-text">
      <div className="fixed inset-0 pointer-events-none opacity-30 bg-grain z-50" />

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl text-sm shadow-xl animate-slide-up pointer-events-auto',
            t.type === 'success' ? 'bg-film-surface border border-film-accent/40 text-film-text' : 'bg-film-surface border border-film-border text-film-muted'
          )}>
            {t.type === 'success' && <CheckCircle size={14} className="text-film-accent shrink-0" />}
            <span>{t.message}</span>
            <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} className="ml-1 text-film-subtle hover:text-film-text"><X size={12} /></button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-film-border bg-film-black/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg tracking-[0.2em] text-film-text">CINEMATIC</span>
            <span className="font-display text-lg tracking-[0.2em] text-film-accent">SHUFFLE</span>
          </div>
          <button onClick={() => setView('profile')} className="flex items-center gap-2 group" title="Profilo">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-film-border group-hover:border-film-accent transition-colors">
              {user.photoURL
                ? <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-film-accent flex items-center justify-center text-film-black text-xs font-bold">
                    {(user.displayName || 'U')[0].toUpperCase()}
                  </div>}
            </div>
            {watchedLoading && <div className="w-3 h-3 border border-film-subtle border-t-transparent rounded-full animate-spin" />}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        {view === 'home' && <HomeView
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            getPersonalRating={getPersonalRating}
            onMarkWatched={markWatched}
            onUnmarkWatched={unmarkWatched}
            onUpdateRating={updateRating}
            onAddToWatchlist={addToWatchlist}
            onRemoveFromWatchlist={removeFromWatchlist}
          />}
        {view === 'shuffle' && <ShuffleView {...sharedProps} />}
        {view === 'search' && <SearchView {...sharedProps} />}
        {view === 'watched' && (
          <WatchedView {...sharedProps} loading={watchedLoading} />
        )}
        {view === 'watchlist' && (
          <WatchlistView watchlist={watchlist} {...sharedProps} />
        )}
        {view === 'profile' && (
          <ProfileView
            user={user}
            watchedMovies={watchedMovies}
            watchlist={watchlist}
            onUpdateRating={updateRating}
            onSignOut={signOut}
          />
        )}
      </main>

      {/* Bottom nav (hidden on profile) */}
      {view !== 'profile' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-film-border bg-film-black/95 backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 flex">
            {NAV.map(({ view: v, icon: Icon, label }) => {
              const active = view === v;
              const badge = v === 'watchlist' ? watchlist.length : v === 'watched' ? watchedMovies.length : 0;
              return (
                <button key={v} onClick={() => setView(v)}
                  className={cn('flex-1 flex flex-col items-center gap-1 py-3 transition-all relative',
                    active ? 'text-film-accent' : 'text-film-subtle hover:text-film-muted')}>
                  {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-film-accent rounded-full" />}
                  <div className="relative">
                    <Icon size={19} strokeWidth={active ? 2 : 1.5} />
                    {badge > 0 && !active && (
                      <span className="absolute -top-1.5 -right-2 bg-film-accent text-film-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] uppercase tracking-widest font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Back button on profile */}
      {view === 'profile' && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40">
          <button onClick={() => setView('home')}
            className="flex items-center gap-2 px-5 py-2.5 bg-film-surface border border-film-border rounded-full text-film-muted hover:text-film-text text-sm transition-all hover:scale-105">
            ← Torna alla home
          </button>
        </div>
      )}
    </div>
  );
}
