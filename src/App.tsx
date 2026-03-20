import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Shuffle, Search, X, CheckCircle, User, Moon } from 'lucide-react';
import type { AppView, TMDBMovieDetail } from './types';
import { useAuth } from './hooks/useAuth';
import { useWatched } from './hooks/useWatched';
import { useNavigationStack } from './hooks/useNavigationStack';
import type { PlaylistItem } from './hooks/useNavigationStack';
import { getMovieDetail } from './services/tmdb';
import { HomeView } from './components/HomeView';
import { TonightView } from './components/TonightView';
import { ShuffleView } from './components/ShuffleView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { InstallPrompt } from './components/InstallPrompt';
import { MovieDetailScreen } from './components/MovieDetailScreen';
import { useUpdatePrompt } from './hooks/useUpdatePrompt';
import { cn } from './utils';
import { getTitle } from './services/tmdb';

// ─── Login screen ───────────────────────────────────────────────
function LoginScreen({ onSignIn, loading, error }: {
  onSignIn: () => void; loading: boolean; error: string | null
}) {
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
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-white hover:bg-gray-100 text-gray-800 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-60">
            {loading
              ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )
            }
            {loading ? 'Accesso in corso...' : 'Accedi con Google'}
          </button>
          {error && <p className="text-film-red text-xs text-center">{error}</p>}
        </div>
        <p className="text-film-subtle text-xs text-center">I tuoi dati sono privati e accessibili solo a te</p>
      </div>
    </div>
  );
}

// ─── Nav items ──────────────────────────────────────────────────
const NAV: { view: AppView; icon: typeof Shuffle; label: string }[] = [
  { view: 'home',    icon: TrendingUp, label: 'Home'    },
  { view: 'tonight', icon: Moon,       label: 'Stasera' },
  { view: 'shuffle', icon: Shuffle,    label: 'Shuffle' },
  { view: 'search',  icon: Search,     label: 'Cerca'   },
  { view: 'profile', icon: User,       label: 'Profilo' },
];

// Labels for back button per ogni tab
const VIEW_LABELS: Record<AppView, string> = {
  tonight: 'Stasera',
  home: 'Home',
  shuffle: 'Shuffle',
  search: 'Cerca',
  profile: 'Profilo',
};

interface Toast { id: number; message: string; type: 'success' | 'info' }

// ─── App ────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Navigation stack for movie detail fullscreen
  const navStack = useNavigationStack();
  const [detailMovie, setDetailMovie] = useState<TMDBMovieDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { user, loading: authLoading, error: authError, signInWithGoogle, signOut } = useAuth();
  const {
    watchedMovies, watchedIds, watchlist, watchlistIds,
    markWatched, unmarkWatched, updateRating, toggleLiked, incrementRewatch,
    addToWatchlist, removeFromWatchlist,
  } = useWatched(user);
  const { showUpdate, applyUpdate, dismissUpdate } = useUpdatePrompt();

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => { if (authError) showToast(authError, 'info'); }, [authError, showToast]);
  useEffect(() => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const getPersonalRating = useCallback((id: number) =>
    watchedMovies.find(m => m.id === id)?.personal_rating ?? null, [watchedMovies]);

  const likedIds = useMemo(
    () => new Set(watchedMovies.filter(m => m.liked).map(m => m.id)),
    [watchedMovies]
  );

  // ─── Open movie detail (fullscreen) ──────────────────────────
  const openMovieDetail = useCallback(async (
    id: number,
    mediaType: 'movie' | 'tv',
    fromLabel?: string,
    playlist?: PlaylistItem[],
    playlistIndex?: number
  ) => {
    setDetailLoading(true);
    try {
      const movie = await getMovieDetail(id, mediaType);
      setDetailMovie(movie);
      navStack.push({
        type: 'movie', id, mediaType,
        fromLabel: fromLabel ?? VIEW_LABELS[view],
        playlist,
        playlistIndex: playlistIndex ?? 0,
      });
    } catch { /* silente */ }
    finally { setDetailLoading(false); }
  }, [view, navStack]);

  // Navigate to a related movie from within the detail screen (push to stack)
  const openRelatedMovie = useCallback(async (id: number, mediaType: 'movie' | 'tv') => {
    setDetailLoading(true);
    try {
      const movie = await getMovieDetail(id, mediaType);
      setDetailMovie(movie);
      navStack.push({
        type: 'movie', id, mediaType,
        fromLabel: detailMovie ? getTitle(detailMovie) : 'Indietro',
      });
    } catch { /* silente */ }
    finally { setDetailLoading(false); }
  }, [navStack, detailMovie]);

  // Swipe to adjacent item in playlist
  const handleSwipeToIndex = useCallback(async (newIndex: number) => {
    const current = navStack.current;
    if (!current?.playlist) return;
    const item = current.playlist[newIndex];
    if (!item) return;
    setDetailLoading(true);
    try {
      const movie = await getMovieDetail(item.id, item.mediaType);
      setDetailMovie(movie);
      navStack.updatePlaylistIndex(newIndex);
    } catch { /* silente */ }
    finally { setDetailLoading(false); }
  }, [navStack]);

  // Back from detail — pop stack, if empty close detail
  const handleDetailBack = useCallback(() => {
    navStack.pop();
    if (navStack.stack.length <= 1) {
      // Last entry — close the detail screen
      setDetailMovie(null);
    } else {
      // Go to previous movie in stack
      const prev = navStack.stack[navStack.stack.length - 2];
      if (prev) {
        setDetailLoading(true);
        getMovieDetail(prev.id, prev.mediaType)
          .then(setDetailMovie)
          .catch(() => {})
          .finally(() => setDetailLoading(false));
      }
    }
  }, [navStack]);

  // Change main tab — clears the detail stack
  const handleNavChange = useCallback((v: AppView) => {
    setView(v);
    navStack.clear();
    setDetailMovie(null);
  }, [navStack]);

  // Shared props passed to all main views
  const sharedProps = {
    watchedIds, watchlistIds, watchedMovies,
    likedIds,
    getPersonalRating,
    onMarkWatched: markWatched,
    onUnmarkWatched: unmarkWatched,
    onUpdateRating: updateRating,
    onToggleLiked: toggleLiked,
    onIncrementRewatch: incrementRewatch,
    onAddToWatchlist: addToWatchlist,
    onRemoveFromWatchlist: removeFromWatchlist,
    onOpenMovie: (id: number, mt: 'movie' | 'tv') => openMovieDetail(id, mt),
  };

  // Extended opener that supports playlist context (for grids)
  const openWithPlaylist = useCallback((
    id: number, mt: 'movie' | 'tv',
    playlist?: PlaylistItem[], index?: number,
    label?: string
  ) => {
    openMovieDetail(id, mt, label, playlist, index);
  }, [openMovieDetail]);

  // Current back label for the detail screen
  const backLabel = navStack.stack.length > 1
    ? navStack.stack[navStack.stack.length - 2].fromLabel
    : navStack.current?.fromLabel ?? 'Indietro';

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

  if (!user) {
    return <LoginScreen onSignIn={signInWithGoogle} loading={authLoading} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-film-black text-film-text" >
      <div className="fixed inset-0 pointer-events-none opacity-30 bg-grain z-50" />

      {/* PWA update banner */}
      {showUpdate && (
        <div className="fixed left-4 right-4 z-[70] animate-slide-up"
          style={{ top: '1rem' }}>
          <div className="bg-film-surface border border-film-accent/40 rounded-2xl px-4 py-3 flex items-center gap-4 shadow-2xl">
            <div className="flex-1">
              <p className="text-film-text text-sm font-medium">Aggiornamento disponibile</p>
              <p className="text-film-muted text-xs mt-0.5">Una nuova versione è pronta</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={dismissUpdate} className="text-film-subtle text-xs px-2 py-1">Dopo</button>
              <button onClick={applyUpdate}
                className="bg-film-accent text-film-black text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95">
                Aggiorna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed right-4 z-[60] flex flex-col gap-2 pointer-events-none"
        style={{ top: '1rem' }}>
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl text-sm shadow-xl animate-slide-up pointer-events-auto',
            t.type === 'success'
              ? 'bg-film-surface border border-film-accent/40 text-film-text'
              : 'bg-film-surface border border-film-border text-film-muted'
          )}>
            {t.type === 'success' && <CheckCircle size={14} className="text-film-accent shrink-0" />}
            <span>{t.message}</span>
            <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}
              className="ml-1 text-film-subtle hover:text-film-text">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Header: FIXED con padding-top safe-area — pattern corretto per iOS PWA ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 border-b border-film-border bg-film-black/95 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg tracking-[0.2em] text-film-text">CINEMATIC</span>
            <span className="font-display text-lg tracking-[0.2em] text-film-accent">SHUFFLE</span>
          </div>
        </div>
      </header>

      {/* ── Main content — padding-top compensa l'header fixed ── */}
      <main
        className={view === 'shuffle' ? "max-w-3xl mx-auto" : "max-w-3xl mx-auto px-4 py-4 pb-28"}
        style={{ paddingTop: view === 'shuffle' ? 0 : 'calc(env(safe-area-inset-top) + 57px)' }}
      >
        {view === 'tonight' && (
          <TonightView
            watchlist={watchlist}
            watchedMovies={watchedMovies}
            watchedIds={watchedIds}
            onOpenMovie={(id, mt) => openWithPlaylist(id, mt, undefined, undefined, 'Stasera')}
          />
        )}
        {view === 'home' && (
          <HomeView
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            getPersonalRating={getPersonalRating}
            onMarkWatched={markWatched}
            onUnmarkWatched={unmarkWatched}
            onUpdateRating={updateRating}
            onAddToWatchlist={addToWatchlist}
            onRemoveFromWatchlist={removeFromWatchlist}
            onOpenMovieGlobal={(id: number, mt: 'movie' | 'tv', playlist?: PlaylistItem[], index?: number) => openWithPlaylist(id, mt, playlist, index, 'Home')}
          />
        )}
        {view === 'shuffle' && (
          <ShuffleView
            {...sharedProps}
            watchedMovies={watchedMovies}
            onOpenMovieGlobal={(id: number, mt: 'movie' | 'tv', playlist?: PlaylistItem[], index?: number) => openWithPlaylist(id, mt, playlist, index, 'Shuffle')}
          />
        )}
        {view === 'search' && (
          <SearchView
            {...sharedProps}
            onOpenMovieGlobal={(id: number, mt: 'movie' | 'tv', playlist?: PlaylistItem[], index?: number) => openWithPlaylist(id, mt, playlist, index, 'Cerca')}
          />
        )}

        {view === 'profile' && (
          <ProfileView
            user={user}
            watchedMovies={watchedMovies}
            watchlist={watchlist}
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            likedIds={likedIds}
            getPersonalRating={getPersonalRating}
            onUpdateRating={updateRating}
            onMarkWatched={markWatched}
            onUnmarkWatched={unmarkWatched}
            onToggleLiked={toggleLiked}
            onAddToWatchlist={addToWatchlist}
            onRemoveFromWatchlist={removeFromWatchlist}
            onOpenMovieGlobal={(id, mt, playlist, index) => openWithPlaylist(id, mt, playlist, index, 'Profilo')}
            onSignOut={signOut}
          />
        )}
      </main>

      {/* ── Bottom nav ── */}
      {true && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-film-border bg-film-black/95 backdrop-blur-md"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="max-w-3xl mx-auto px-4 flex">
            {NAV.map(({ view: v, icon: Icon, label }) => {
              const active = view === v;
              return (
                <button key={v} onClick={() => handleNavChange(v)}
                  className={cn('flex-1 flex flex-col items-center gap-1 py-3 transition-all relative',
                    active ? 'text-film-accent' : 'text-film-subtle hover:text-film-muted')}>
                  {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-film-accent rounded-full" />}
                  {v === 'profile' ? (
                    <div className={cn('w-5 h-5 rounded-full overflow-hidden border transition-colors',
                      active ? 'border-film-accent' : 'border-film-subtle')}>
                      {user.photoURL
                        ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-film-accent flex items-center justify-center text-film-black text-[8px] font-bold">
                            {(user.displayName || 'U')[0].toUpperCase()}
                          </div>
                      }
                    </div>
                  ) : (
                    <Icon size={19} strokeWidth={active ? 2 : 1.5} />
                  )}
                  <span className="text-[9px] uppercase tracking-widest font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Profile tab is now in bottom nav — no separate back button needed */}

      {/* ── Movie Detail Fullscreen Overlay ── */}
      {navStack.isOpen && detailMovie && (
        <MovieDetailScreen
          movie={detailMovie}
          isWatched={watchedIds.has(detailMovie.id)}
          isOnWatchlist={watchlistIds.has(detailMovie.id)}
          personalRating={getPersonalRating(detailMovie.id)}
          showShuffleBtn={view === 'shuffle'}
          backLabel={backLabel}
          playlist={navStack.current?.playlist}
          playlistIndex={navStack.current?.playlistIndex ?? 0}
          onSwipeToIndex={navStack.current?.playlist ? handleSwipeToIndex : undefined}
          onBack={handleDetailBack}
          onMarkWatched={r => markWatched(detailMovie, r)}
          onUnmarkWatched={() => unmarkWatched(detailMovie.id)}
          onUpdateRating={r => updateRating(detailMovie.id, r)}
          onAddToWatchlist={() => addToWatchlist(detailMovie)}
          onRemoveFromWatchlist={() => removeFromWatchlist(detailMovie.id)}
          onOpenMovie={openRelatedMovie}
          onToggleLiked={toggleLiked}
          isLiked={detailMovie ? (likedIds.has(detailMovie.id)) : false}
          onIncrementRewatch={incrementRewatch}
          rewatchCount={detailMovie ? (watchedMovies.find(m => m.id === detailMovie.id)?.rewatchCount ?? 0) : 0}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          likedIds={likedIds}
          getPersonalRatingFull={getPersonalRating}
          onMarkWatchedFull={markWatched}
          onUnmarkWatchedFull={unmarkWatched}
          onUpdateRatingFull={updateRating}
          onToggleLikedFull={toggleLiked}
          onAddToWatchlistFull={addToWatchlist}
          onRemoveFromWatchlistFull={removeFromWatchlist}
          loading={detailLoading}
        />
      )}

      {/* Loading overlay while fetching detail */}
      {detailLoading && !navStack.isOpen && (
        <div className="fixed inset-0 z-[75] bg-film-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="w-12 h-12 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {user && <InstallPrompt />}
    </div>
  );
}
