/**
 * InnerMovieDetail — overlay film leggero usato dentro PersonDetailScreen e GenreMoviesScreen.
 *
 * Perché esiste: quando l'utente naviga Cast → film, o Genere → film,
 * il "Back" deve tornare alla lista da cui è venuto (Cast/Genere), non al film originale.
 * Questo componente si apre "sopra" PersonDetailScreen/GenreMoviesScreen (z-[95])
 * e il suo Back chiama semplicemente onBack() che chiude solo questo overlay.
 *
 * È una versione compatta di MovieDetailScreen che:
 * - Fetcha i dati del film in autonomia
 * - Mostra le info principali (backdrop, titolo, trama, cast, simili)
 * - NON ha le CTA watched/liked (per semplicità — l'utente può aprire la scheda completa)
 * - Ha un header con "← Indietro" e "Apri scheda completa" che usa onOpenFull
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, Star, Clock, Play, ExternalLink } from 'lucide-react';
import { getMovieDetail, getImageUrl, getTitle, getReleaseDate, getBestTrailer, getWatchProviders, getProviderLogoUrl } from '../services/tmdb';
import type { TMDBMovieDetail } from '../types';
import { formatYear, formatRating, formatRuntime } from '../utils';

interface InnerMovieDetailProps {
  id: number;
  mediaType: 'movie' | 'tv';
  watchedIds: Set<number>;
  onBack: () => void;
  /** Opzionale: per aprire la scheda completa nel flusso principale */
  onOpenFull?: (id: number, mediaType: 'movie' | 'tv') => void;
}

export function InnerMovieDetail({ id, mediaType, watchedIds, onBack, onOpenFull }: InnerMovieDetailProps) {
  const [movie, setMovie] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Per aprire un film simile → nuovo InnerMovieDetail sopra questo
  const [innerInner, setInnerInner] = useState<{id: number; mediaType: 'movie'|'tv'} | null>(null);

  useEffect(() => {
    setLoading(true);
    setMovie(null);
    getMovieDetail(id, mediaType)
      .then(setMovie)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, mediaType]);

  const isWatched = watchedIds.has(id);

  return (
    <div className="fixed inset-0 z-[95] bg-film-black overflow-y-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header fisso */}
      <div className="sticky top-0 z-10 bg-film-black/95 backdrop-blur-md border-b border-film-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-8 h-8 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <ChevronLeft size={18} className="text-film-text" />
            </div>
          </button>
          <p className="flex-1 text-film-text font-semibold truncate text-sm">
            {movie ? getTitle(movie) : '...'}
          </p>
          {isWatched && (
            <span className="text-green-400 text-xs font-medium shrink-0">✓ Visto</span>
          )}
          {onOpenFull && movie && (
            <button
              onClick={() => onOpenFull(id, mediaType)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-film-surface border border-film-border text-film-muted active:opacity-60 text-xs shrink-0"
            >
              <ExternalLink size={12} />
              Scheda
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {movie && !loading && (
        <div className="space-y-4 pb-8">
          {/* Backdrop */}
          {movie.backdrop_path && (
            <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
              <img src={getImageUrl(movie.backdrop_path, 'w780') || ''} alt=""
                className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-film-black/70" />
              {getBestTrailer(movie) && (
                <a href={getBestTrailer(movie)!} target="_blank" rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-film-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                    <Play size={18} className="text-white ml-0.5" fill="white" />
                  </div>
                </a>
              )}
            </div>
          )}

          <div className="px-4 space-y-3">
            {/* Titolo + meta */}
            <div>
              <h2 className="font-display text-2xl text-film-text tracking-wide">{getTitle(movie)}</h2>
              {movie.tagline && <p className="text-film-accent text-xs italic mt-0.5">"{movie.tagline}"</p>}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {movie.vote_average > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-film-accent" fill="currentColor" />
                  <span className="text-film-accent text-sm font-mono font-bold">{formatRating(movie.vote_average)}</span>
                  <span className="text-film-subtle text-xs">/10</span>
                </div>
              )}
              <span className="text-film-border text-xs">·</span>
              <span className="text-film-muted text-sm">{formatYear(getReleaseDate(movie))}</span>
              {movie.runtime && (
                <>
                  <span className="text-film-border text-xs">·</span>
                  <div className="flex items-center gap-1 text-film-muted">
                    <Clock size={11} />
                    <span className="text-sm">{formatRuntime(movie.runtime)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Generi */}
            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {movie.genres.map(g => (
                  <span key={g.id} className="px-2 py-0.5 rounded-lg bg-film-card border border-film-border text-film-muted text-xs">
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {/* Trama */}
            {movie.overview && (
              <p className="text-film-text/75 text-sm leading-relaxed">{movie.overview}</p>
            )}

            {/* Provider */}
            {(() => {
              const providers = getWatchProviders(movie);
              const streaming = [...(providers?.flatrate ?? []), ...(providers?.free ?? [])]
                .filter((p, i, a) => a.findIndex(x => x.provider_id === p.provider_id) === i)
                .slice(0, 5);
              return streaming.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-film-subtle text-xs">Disponibile su</span>
                  {streaming.map(p => (
                    <img key={p.provider_id}
                      src={getProviderLogoUrl(p.logo_path)} alt={p.provider_name}
                      className="w-6 h-6 rounded-md" title={p.provider_name} />
                  ))}
                </div>
              ) : null;
            })()}

            {/* Cast orizzontale */}
            {(movie.credits?.cast?.length ?? 0) > 0 && (
              <div>
                <p className="text-film-subtle text-xs uppercase tracking-wider mb-2">Cast</p>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
                  {movie.credits.cast.slice(0, 10).map(actor => (
                    <div key={actor.id} className="shrink-0 w-14 text-center">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-film-surface border border-film-border mx-auto">
                        {actor.profile_path
                          ? <img src={getImageUrl(actor.profile_path, 'w92') || ''} alt={actor.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-film-subtle text-lg">{actor.name[0]}</div>
                        }
                      </div>
                      <p className="text-film-text text-xs mt-1 line-clamp-2 leading-tight">{actor.name}</p>
                      <p className="text-film-subtle text-xs line-clamp-1 italic">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Film simili — navigazione interna */}
            {(() => {
              const similar = (movie.recommendations?.results?.length
                ? movie.recommendations.results : movie.similar?.results ?? []).slice(0, 8);
              return similar.length > 0 ? (
                <div>
                  <p className="text-film-subtle text-xs uppercase tracking-wider mb-2">
                    {movie.media_type === 'tv' ? 'Serie simili' : 'Film simili'}
                  </p>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4">
                    {similar.map(item => (
                      <button key={item.id}
                        onClick={() => setInnerInner({ id: item.id, mediaType: movie.media_type })}
                        className="shrink-0 w-20 text-left active:scale-95 transition-all">
                        <div className="w-20 aspect-[2/3] rounded-xl overflow-hidden bg-film-surface border border-film-border">
                          {item.poster_path
                            ? <img src={getImageUrl(item.poster_path, 'w185') || ''} alt={getTitle(item)} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>
                          }
                        </div>
                        <p className="text-film-text text-xs mt-1 line-clamp-2 leading-tight">{getTitle(item)}</p>
                        {item.vote_average > 0 && (
                          <p className="text-film-accent text-xs">★ {item.vote_average.toFixed(1)}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* CTA scheda completa */}
            {onOpenFull && (
              <button onClick={() => onOpenFull(id, mediaType)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-film-surface border border-film-border text-film-muted text-sm active:opacity-70 transition-opacity">
                <ExternalLink size={14} />
                Apri scheda completa
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ricorsione: film simile dentro InnerMovieDetail */}
      {innerInner && (
        <InnerMovieDetail
          id={innerInner.id}
          mediaType={innerInner.mediaType}
          watchedIds={watchedIds}
          onBack={() => setInnerInner(null)}
          onOpenFull={onOpenFull}
        />
      )}
    </div>
  );
}
