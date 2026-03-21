/**
 * PersonDetailScreen — scheda fullscreen di un attore/membro della crew.
 * Foto, bio, crediti divisi per ruolo, badge film visti.
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, Film, Tv } from 'lucide-react';
import { InnerMovieDetail } from './InnerMovieDetail';
import type { TMDBPerson, TMDBPersonCredits, TMDBPersonCreditMovie } from '../services/tmdb';
import { getPersonDetail, getPersonCredits, getImageUrl, getTitle, getReleaseDate } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils';

interface PersonDetailScreenProps {
  personId: number;
  personName: string;
  backLabel?: string;
  watchedIds: Set<number>;
  onBack: () => void;
  onOpenMovie?: (id: number, mediaType: 'movie' | 'tv') => void;
}

export function PersonDetailScreen({
  personId, personName, backLabel: _backLabel = 'Indietro',
  watchedIds, onBack, onOpenMovie: _onOpenMovie,
}: PersonDetailScreenProps) {
  const [person, setPerson] = useState<TMDBPerson | null>(null);
  const [credits, setCredits] = useState<TMDBPersonCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'cast' | 'crew'>('cast');
  const [innerMovie, setInnerMovie] = useState<{id: number; mediaType: 'movie'|'tv'} | null>(null);
  const [expandBio, setExpandBio] = useState(false);

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
  const watchedCastCount = credits?.cast.filter(m => watchedIds.has(m.id)).length ?? 0;
  const watchedCrewCount = Object.values(crewByDepartment).flat()
    .filter((m, i, a) => a.findIndex(x => x.id === m.id) === i && watchedIds.has(m.id)).length;

  return (
    <div
      className="fixed inset-0 z-[88] bg-film-black overflow-y-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-film-black/95 backdrop-blur-md border-b border-film-border"
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
                  🗓 {new Date(person.birthday).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                  {expandBio ? '↑ Mostra meno' : '↓ Leggi tutto'}
                </button>
              )}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-2">
            <TabBtn
              active={tab === 'cast'}
              onClick={() => setTab('cast')}
              label="Come attore"
              badge={castCount}
              watchedBadge={watchedCastCount}
            />
            <TabBtn
              active={tab === 'crew'}
              onClick={() => setTab('crew')}
              label="Ruoli tecnici"
              badge={Object.values(crewByDepartment).flat().filter((m, i, a) => a.findIndex(x => x.id === m.id) === i).length}
              watchedBadge={watchedCrewCount}
            />
          </div>

          {/* Cast list */}
          {tab === 'cast' && credits && (
            <div className="space-y-1">
              {castCount > 0 && (
                <div className="flex items-center justify-between py-2 px-1 mb-1">
                  <span className="text-film-subtle text-xs uppercase tracking-wider">Film come attore</span>
                  <span className={cn('text-xs font-medium', watchedCastCount > 0 ? 'text-green-400' : 'text-film-subtle')}>
                    {watchedCastCount > 0 ? `${watchedCastCount} visti su ${castCount}` : `${castCount} in totale`}
                  </span>
                </div>
              )}
              {credits.cast.length === 0 ? (
                <p className="text-film-muted text-sm py-4 text-center">Nessun credito come attore</p>
              ) : (
                credits.cast.map(m => (
                  <MovieCreditRow
                    key={`cast-${m.id}-${m.character}`}
                    movie={m}
                    subtitle={m.character ? `come "${m.character}"` : ''}
                    isWatched={watchedIds.has(m.id)}
                    onClick={() => setInnerMovie({ id: m.id, mediaType: m.media_type })}
                  />
                ))
              )}
            </div>
          )}

          {/* Crew by department */}
          {tab === 'crew' && (
            <div className="space-y-5">
              {Object.keys(crewByDepartment).length === 0 ? (
                <p className="text-film-muted text-sm py-4 text-center">Nessun credito tecnico</p>
              ) : (
                Object.entries(crewByDepartment)
                  .sort(([a], [b]) => {
                    // Put Directing and Writing first
                    const order = ['Directing', 'Writing', 'Production', 'Camera'];
                    return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99);
                  })
                  .map(([dept, movies]) => (
                    <div key={dept}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-film-subtle text-xs uppercase tracking-widest">{dept}</h3>
                        <span className="text-film-subtle text-xs">· {movies.length}</span>
                        {movies.some(m => watchedIds.has(m.id)) && (
                          <span className="text-green-400 text-xs">
                            · {movies.filter(m => watchedIds.has(m.id)).length} visti
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {movies.map(m => (
                          <MovieCreditRow
                            key={`crew-${m.id}-${m.job}`}
                            movie={m}
                            subtitle={m.job ?? ''}
                            isWatched={watchedIds.has(m.id)}
                            onClick={() => setInnerMovie({ id: m.id, mediaType: m.media_type })}
                          />
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-film-muted">
          <p>Impossibile caricare i dettagli</p>
        </div>
      )}
      {/* Inner movie detail — opens on top, back returns here */}
      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id}
          mediaType={innerMovie.mediaType}
          watchedIds={watchedIds}
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

function MovieCreditRow({ movie, subtitle, isWatched, onClick }: {
  movie: TMDBPersonCreditMovie; subtitle: string;
  isWatched: boolean; onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const poster = !imgErr ? getImageUrl(movie.poster_path, 'w92') : null;
  const title = getTitle(movie);
  const year = formatYear(getReleaseDate(movie));

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 px-2 rounded-xl active:bg-film-surface/60 transition-colors text-left"
    >
      {/* Mini poster */}
      <div className="shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-film-surface border border-film-border">
        {poster
          ? <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-xs text-film-subtle">
              {movie.media_type === 'tv' ? '📺' : '🎬'}
            </div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-sm font-medium truncate', isWatched ? 'text-film-text' : 'text-film-muted')}>
            {title}
          </p>
          {isWatched && <span className="shrink-0 text-green-400 text-xs">✓</span>}
          {movie.media_type === 'tv' && <Tv size={10} className="shrink-0 text-purple-400" />}
          {movie.media_type === 'movie' && <Film size={10} className="shrink-0 text-film-subtle" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {year && <span className="text-film-subtle text-xs">{year}</span>}
          {subtitle && <span className="text-film-subtle text-xs truncate italic">{subtitle}</span>}
        </div>
      </div>

      {/* Rating */}
      {movie.vote_average > 0 && (
        <span className="shrink-0 text-film-accent text-xs font-mono">
          ★ {formatRating(movie.vote_average)}
        </span>
      )}
    </button>
  );
}
