/**
 * PersonDetailScreen — scheda fullscreen di un attore/membro della crew.
 * Foto, bio, crediti divisi per ruolo, badge film visti.
 */
import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { InnerMovieDetail } from './InnerMovieDetail';
import type { TMDBPerson, TMDBPersonCredits, TMDBPersonCreditMovie } from '../services/tmdb';
import { getPersonDetail, getPersonCredits, getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, cn, mkey } from '../utils';

interface PersonDetailScreenProps {
  personId: number;
  personName: string;
  backLabel?: string;
  watchedIds: Set<string>;
  watchlistIds?: Set<string>;
  likedIds?: Set<string>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: import('../types').TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onAddToWatchlist?: (movie: import('../types').TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
  onOpenMovie?: (id: number, mediaType: 'movie' | 'tv') => void;
}

export function PersonDetailScreen({
  personId, personName, backLabel: _backLabel = 'Back',
  watchedIds, watchlistIds = new Set(), likedIds = new Set(),
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating, onToggleLiked,
  onIncrementRewatch, onAddToWatchlist, onRemoveFromWatchlist,
  onBack, onOpenMovie: _onOpenMovie,
}: PersonDetailScreenProps) {
  const [person, setPerson] = useState<TMDBPerson | null>(null);
  const [credits, setCredits] = useState<TMDBPersonCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'cast' | 'crew'>('cast');
  const [innerMovie, setInnerMovie] = useState<{id: number; mediaType: 'movie'|'tv'} | null>(null);
  const [expandBio, setExpandBio] = useState(false);
  const [onlyUnseen, setOnlyUnseen] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'tv'>('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([getPersonDetail(personId), getPersonCredits(personId)])
      .then(([p, c]) => { setPerson(p); setCredits(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [personId]);

  // Group crew by department
  const crewByDepartment = credits?.crew.reduce<Record<string, TMDBPersonCreditMovie[]>>((acc, m) => {
    const dept = m.department ?? 'Other';
    acc[dept] = acc[dept] ?? [];
    // Avoid duplicates
    if (!acc[dept].find(x => x.id === m.id)) acc[dept].push(m);
    return acc;
  }, {}) ?? {};

  const castCount = credits?.cast.length ?? 0;
  const watchedCastCount = credits?.cast.filter(m => watchedIds.has(mkey(m.id, m.media_type))).length ?? 0;
  const watchedCrewCount = Object.values(crewByDepartment).flat()
    .filter((m, i, a) => a.findIndex(x => x.id === m.id) === i && watchedIds.has(mkey(m.id, m.media_type))).length;

  // Completismo: filmografia "principale" della persona (regia se regista,
  // altrimenti recitazione) per il banner in cima.
  const directingCredits = crewByDepartment['Directing'] ?? [];
  const isDirector = (person?.known_for_department === 'Directing') || directingCredits.length > castCount;
  const primaryCredits = isDirector ? directingCredits : (credits?.cast ?? []);
  const primaryWatched = primaryCredits.filter(m => watchedIds.has(mkey(m.id, m.media_type))).length;
  const primaryPct = primaryCredits.length ? Math.round((primaryWatched / primaryCredits.length) * 100) : 0;
  const primaryLabel = isDirector ? 'Director filmography' : 'Acting filmography';
  const passesFilters = (m: { id: number; media_type: 'movie' | 'tv' }) =>
    (!onlyUnseen || !watchedIds.has(mkey(m.id, m.media_type))) &&
    (mediaFilter === 'all' || m.media_type === mediaFilter);

  return (
    <div
      className="fixed left-0 right-0 z-[88] bg-film-black flex flex-col"
      style={{ top: 0, bottom: 0, isolation: 'isolate' }}
    >
      {/* Header */}
      <div
        className="shrink-0 bg-film-black border-b border-film-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-8 h-8 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-film-text font-semibold truncate">{person?.name ?? personName}</p>
            <p className="text-film-subtle text-xs">{person?.known_for_department}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'var(--nav-h, 60px)' }}>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : person ? (
        <div className="px-4 py-5 space-y-5">
          {/* Bio row */}
          <div className="flex gap-4">
            {/* Photo */}
            <div className="shrink-0 w-24 aspect-[2/3] rounded-2xl overflow-hidden border border-film-border bg-film-surface">
              {person.profile_path
                ? <img src={getImageUrl(person.profile_path, 'w185') || ''} alt={person.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl text-film-subtle font-display">
                    {person.name[0]}
                  </div>
              }
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <h1 className="font-display text-2xl text-film-text leading-tight">{person.name}</h1>
              <p className="text-film-accent text-xs">{person.known_for_department}</p>
              {person.birthday && (
                <p className="text-film-muted text-xs">
                  🗓 {new Date(person.birthday).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {person.place_of_birth && (
                <p className="text-film-muted text-xs">📍 {person.place_of_birth}</p>
              )}
            </div>
          </div>

          {/* Bio text */}
          {person.biography && (
            <div>
              <p className={cn('text-film-text/75 text-sm leading-relaxed', !expandBio && 'line-clamp-4')}>
                {person.biography}
              </p>
              {person.biography.length > 200 && (
                <button onClick={() => setExpandBio(!expandBio)}
                  className="text-film-accent text-xs mt-1 active:opacity-70">
                  {expandBio ? '↑ Show less' : '↓ Read more'}
                </button>
              )}
            </div>
          )}

          {/* Banner completismo filmografia */}
          {primaryCredits.length > 0 && (
            <div className="bg-gradient-to-r from-film-accent/15 to-transparent border border-film-accent/30 rounded-2xl p-4 flex items-center gap-4">
              <p className="font-display text-3xl text-film-accent leading-none shrink-0">
                {primaryWatched}<span className="text-film-subtle text-lg">/{primaryCredits.length}</span>
              </p>
              <div className="flex-1 min-w-0">
                <p className="text-film-text text-sm font-medium">{primaryLabel}</p>
                <div className="h-1.5 rounded-full bg-film-card overflow-hidden mt-2">
                  <div className="h-full bg-film-accent rounded-full" style={{ width: `${primaryPct}%` }} />
                </div>
                <p className="text-film-subtle text-xs mt-1">{primaryPct}% complete</p>
              </div>
            </div>
          )}

          {/* Tab bar + filtro */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <TabBtn
                active={tab === 'cast'}
                onClick={() => setTab('cast')}
                label="As actor"
                badge={castCount}
                watchedBadge={watchedCastCount}
              />
              <TabBtn
                active={tab === 'crew'}
                onClick={() => setTab('crew')}
                label="Crew"
                badge={Object.values(crewByDepartment).flat().filter((m, i, a) => a.findIndex(x => x.id === m.id) === i).length}
                watchedBadge={watchedCrewCount}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Segmentato tipo */}
              <div className="flex gap-1 bg-film-surface border border-film-border rounded-full p-0.5">
                {([['all', 'All'], ['movie', 'Film'], ['tv', 'TV']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setMediaFilter(val)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      mediaFilter === val ? 'bg-film-accent text-film-black' : 'text-film-muted'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setOnlyUnseen(v => !v)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border transition-colors',
                  onlyUnseen ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-surface text-film-muted border-film-border'
                )}
              >
                {onlyUnseen ? '✓ ' : ''}To watch only
              </button>
            </div>
          </div>

          {/* Cast list */}
          {tab === 'cast' && credits && (
            <div>
              {castCount > 0 && (
                <div className="flex items-center justify-between py-2 px-1 mb-3">
                  <span className="text-film-subtle text-xs uppercase tracking-wider">Acting credits</span>
                  <span className={cn('text-xs font-medium', watchedCastCount > 0 ? 'text-green-400' : 'text-film-subtle')}>
                    {watchedCastCount > 0 ? `${watchedCastCount} of ${castCount} watched` : `${castCount} total`}
                  </span>
                </div>
              )}
              {credits.cast.length === 0 ? (
                <p className="text-film-muted text-sm py-4 text-center">No acting credits</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {credits.cast.filter(passesFilters).map(m => (
                    <CreditPoster
                      key={`cast-${m.id}`}
                      movie={m}
                      subtitle={m.character}
                      isWatched={watchedIds.has(mkey(m.id, m.media_type))}
                      onClick={() => setInnerMovie({ id: m.id, mediaType: m.media_type })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Crew by department */}
          {tab === 'crew' && (
            <div className="space-y-5">
              {Object.keys(crewByDepartment).length === 0 ? (
                <p className="text-film-muted text-sm py-4 text-center">No crew credits</p>
              ) : (
                Object.entries(crewByDepartment)
                  .sort(([a], [b]) => {
                    const order = ['Directing', 'Writing', 'Production', 'Camera'];
                    return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99);
                  })
                  .map(([dept, movies]) => {
                    const watched = movies.filter(m => watchedIds.has(mkey(m.id, m.media_type))).length;
                    return (
                    <div key={dept}>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-film-subtle text-xs uppercase tracking-widest">{dept}</h3>
                        <span className="text-film-subtle text-xs">· {movies.length}</span>
                        {watched > 0 && <span className="text-green-400 text-xs">· {watched} watched</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {movies.filter(passesFilters).map(m => (
                          <CreditPoster
                            key={`crew-${m.id}`}
                            movie={m}
                            subtitle={m.job ?? ''}
                            isWatched={watchedIds.has(mkey(m.id, m.media_type))}
                            onClick={() => setInnerMovie({ id: m.id, mediaType: m.media_type })}
                          />
                        ))}
                      </div>
                    </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-film-muted">
          <p>Could not load details</p>
        </div>
      )}
      </div>
      {/*
       * InnerMovieDetail MUST be outside the overflow-y:auto scroll container.
       * On iOS Safari, fixed-position descendants of overflow:auto elements can
       * have their containing block incorrectly set to the scroll layer instead
       * of the viewport, causing the nested PersonDetailScreen header to render
       * with a wrong top offset (appearing "too tall"). Rendering InnerMovieDetail
       * as a sibling of the scroll div — still inside our own fixed container —
       * prevents the WebKit compositor from associating its fixed subtree with
       * the scroll layer.
       */}
      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id}
          mediaType={innerMovie.mediaType}
          watchedIds={watchedIds}
          watchlistIds={watchlistIds}
          likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched}
          onUnmarkWatched={onUnmarkWatched}
          onUpdateRating={onUpdateRating}
          onToggleLiked={onToggleLiked}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, badge, watchedBadge }: {
  active: boolean; onClick: () => void;
  label: string; badge: number; watchedBadge: number;
}) {
  const pct = badge > 0 ? Math.round((watchedBadge / badge) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-2.5 px-3 rounded-2xl text-sm font-medium border transition-all text-left',
        active ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-surface border-film-border text-film-muted'
      )}
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className={cn('text-xs font-mono', active ? 'text-film-black/60' : 'text-film-subtle')}>{badge}</span>
      </div>
      {badge > 0 && (
        <div className="flex items-center gap-1.5 mt-1">
          {/* Progress bar */}
          <div className={cn('flex-1 h-1 rounded-full overflow-hidden', active ? 'bg-film-black/20' : 'bg-film-border')}>
            <div
              className={cn('h-full rounded-full', active ? 'bg-green-700' : 'bg-green-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn('text-xs shrink-0', active ? 'text-green-700' : 'text-green-500')}>
            {watchedBadge}/{badge}
          </span>
        </div>
      )}
    </button>
  );
}


function CreditPoster({ movie, subtitle, isWatched, onClick }: {
  movie: TMDBPersonCreditMovie;
  subtitle?: string;
  isWatched: boolean;
  onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const poster = !imgErr ? getImageUrl(movie.poster_path, 'w342') : null;
  const title = getTitle(movie);
  const year = formatYear(getReleaseDate(movie));

  return (
    <button onClick={onClick}
      className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:scale-[0.97] transition-transform text-left w-full">
      {poster
        ? <img src={poster} alt={title} className={`w-full h-full object-cover ${isWatched ? 'opacity-40 grayscale' : ''}`} onError={() => setImgErr(true)} />
        : <div className="w-full h-full flex items-center justify-center text-xl text-film-subtle">
            {movie.media_type === 'tv' ? '📺' : '🎬'}
          </div>
      }
      {isWatched && (
        <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full w-4 h-4 flex items-center justify-center">
          <span className="text-white text-[8px] font-bold">✓</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/95 via-film-black/50 to-transparent px-1.5 pt-6 pb-1.5 pointer-events-none">
        <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{title}</p>
        {year && <p className="text-white/50 text-xs">{year}</p>}
        {subtitle && <p className="text-white/40 text-[10px] line-clamp-1 italic">{subtitle}</p>}
      </div>
    </button>
  );
}
