import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Star, Film, Users, ChevronRight, Building2 } from 'lucide-react';
import type { TMDBMovieDetail, TMDBMovieBasic } from '../types';
import {
  searchContent, searchPeople, searchCompanies, getCompanyMovies,
  getImageUrl, getEnglishTitle, getOriginalTitle, getReleaseDate,
  getProviderLogoUrl,
} from '../services/tmdb';
import type { PersonSearchResult, CompanySearchResult } from '../services/tmdb';
import type { SearchResult } from '../types';
import { formatYear, formatRating, cn } from '../utils';
import { InnerMovieDetail } from './InnerMovieDetail';
import { PersonDetailScreen } from './PersonDetailScreen';

interface SearchViewProps {
  watchedIds: Set<number>;
  watchlistIds: Set<number>;
  likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onOpenMovieGlobal?: (id: number, mediaType: 'movie' | 'tv') => void;
}

type SearchTab = 'films' | 'people';

// ── Company movies screen ─────────────────────────────────────────
function CompanyMoviesScreen({
  company, watchedIds, watchlistIds, likedIds,
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onToggleLiked, onIncrementRewatch, onAddToWatchlist, onRemoveFromWatchlist,
  onBack,
}: {
  company: CompanySearchResult;
  watchedIds: Set<number>; watchlistIds?: Set<number>; likedIds?: Set<number>;
  getPersonalRating?: (id: number) => number | null;
  onMarkWatched?: (movie: TMDBMovieDetail, rating: number | null) => Promise<void>;
  onUnmarkWatched?: (id: number) => Promise<void>;
  onUpdateRating?: (id: number, rating: number | null) => Promise<void>;
  onToggleLiked?: (id: number) => Promise<void>;
  onIncrementRewatch?: (id: number, delta: number) => Promise<void>;
  onAddToWatchlist?: (movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromWatchlist?: (id: number) => Promise<void>;
  onBack: () => void;
}) {
  const [movies, setMovies] = useState<TMDBMovieBasic[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [innerMovie, setInnerMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);

  useEffect(() => {
    setLoading(true);
    getCompanyMovies(company.id, 1).then(res => {
      setMovies(res.results);
      setTotalPages(res.total_pages);
    }).finally(() => setLoading(false));
  }, [company.id]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const next = page + 1;
    const res = await getCompanyMovies(company.id, next);
    setMovies(prev => [...prev, ...res.results]);
    setPage(next);
    setLoadingMore(false);
  }, [company.id, page, totalPages, loadingMore]);

  // Virtual scroll: load more when near bottom
  const listRef = useRef<HTMLDivElement>(null);
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) loadMore();
  }, [loadMore]);

  return (
    <div className="fixed inset-0 z-[95] bg-film-black flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className="shrink-0 bg-film-black/95 backdrop-blur-md border-b border-film-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <X size={16} className="text-film-text" />
            </div>
          </button>
          {company.logo_path
            ? <img src={getProviderLogoUrl(company.logo_path)} alt={company.name} className="h-6 object-contain" />
            : <Building2 size={18} className="text-film-accent" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-film-text font-semibold truncate">{company.name}</p>
            {movies.length > 0 && <p className="text-film-subtle text-xs">{movies.length} film</p>}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            {movies.map(m => (
              <button key={m.id} onClick={() => setInnerMovie({ id: m.id, mediaType: 'movie' })}
                className="relative aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:scale-[0.97] transition-transform">
                {m.poster_path
                  ? <img src={getImageUrl(m.poster_path, 'w342') || ''} alt={getEnglishTitle(m)} className={cn("w-full h-full object-cover", watchedIds.has(m.id) && "opacity-40 grayscale")} />
                  : <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>
                }
                {watchedIds.has(m.id) && (
                  <div className="absolute top-1.5 right-1.5 bg-green-900/80 backdrop-blur-sm rounded-lg p-1">
                    <Star size={8} className="text-green-300" fill="currentColor" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-film-black/90 to-transparent px-1.5 pt-6 pb-1.5 pointer-events-none">
                  <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{getEnglishTitle(m)}</p>
                  <p className="text-white/50 text-xs">{formatYear(getReleaseDate(m))}</p>
                </div>
              </button>
            ))}
          </div>
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-8 h-8 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {innerMovie && (
        <InnerMovieDetail
          id={innerMovie.id} mediaType={innerMovie.mediaType}
          watchedIds={watchedIds} watchlistIds={watchlistIds} likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched} onUnmarkWatched={onUnmarkWatched}
          onUpdateRating={onUpdateRating} onToggleLiked={onToggleLiked}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlist} onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setInnerMovie(null)}
        />
      )}
    </div>
  );
}

// ── Main SearchView ───────────────────────────────────────────────
export function SearchView({
  watchedIds, watchlistIds, likedIds = new Set(),
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onToggleLiked, onIncrementRewatch, onAddToWatchlist, onRemoveFromWatchlist,
  onOpenMovieGlobal: _onOpenMovieGlobal,
}: SearchViewProps) {
  const [tab, setTab] = useState<SearchTab>('films');
  const [query, setQuery] = useState('');
  const [filmResults, setFilmResults] = useState<SearchResult[]>([]);
  const [peopleResults, setPeopleResults] = useState<PersonSearchResult[]>([]);
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [openPerson, setOpenPerson] = useState<{ id: number; name: string } | null>(null);
  const [openCompany, setOpenCompany] = useState<CompanySearchResult | null>(null);
  const [openMovie, setOpenMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setFilmResults([]); setPeopleResults([]); setCompanyResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        if (tab === 'films') {
          const r = await searchContent(q);
          setFilmResults(r);
        } else {
          const [people, companies] = await Promise.all([searchPeople(q), searchCompanies(q)]);
          setPeopleResults(people);
          setCompanyResults(companies);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }, 350);
  }

  // Re-search when tab changes if query is present
  useEffect(() => {
    if (query.trim()) handleSearch(query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const hasResults = tab === 'films' ? filmResults.length > 0 : (peopleResults.length > 0 || companyResults.length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 52px)' }}>
        <div className="flex items-center gap-2.5 bg-film-surface border border-film-border rounded-2xl px-3 py-2.5 focus-within:border-film-accent transition-colors">
          {loading
            ? <div className="w-4 h-4 border-2 border-film-accent border-t-transparent rounded-full animate-spin shrink-0" />
            : <Search size={16} className="text-film-muted shrink-0" />}
          <input
            type="text"
            placeholder={tab === 'films' ? 'Cerca film o serie TV...' : 'Cerca attori, registi, studios...'}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            autoComplete="off" autoCorrect="off" spellCheck={false}
            className="flex-1 bg-transparent text-film-text placeholder:text-film-subtle text-sm focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setFilmResults([]); setPeopleResults([]); setCompanyResults([]); }} className="active:opacity-60 shrink-0">
              <X size={15} className="text-film-muted" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {([['films', Film, 'Film'], ['people', Users, 'Cast, Crew & Studios']] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTab(t as SearchTab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 border',
                tab === t
                  ? 'bg-film-accent text-film-black border-film-accent'
                  : 'bg-film-surface text-film-muted border-film-border'
              )}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {/* Empty state */}
        {!query && !hasResults && (
          <div className="text-center py-16 text-film-muted">
            {tab === 'films'
              ? <><Film size={40} className="mx-auto mb-4 opacity-30" /><p className="text-sm">Cerca un film o serie TV</p></>
              : <><Users size={40} className="mx-auto mb-4 opacity-30" /><p className="text-sm">Cerca attori, registi o studios</p></>
            }
          </div>
        )}

        {/* Film results */}
        {tab === 'films' && filmResults.length > 0 && (
          <div className="space-y-0 rounded-2xl overflow-hidden border border-film-border bg-film-card">
            {filmResults.map((r, i) => (
              <button key={r.id} onClick={() => setOpenMovie({ id: r.id, mediaType: r.media_type })}
                className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface transition-colors text-left", i < filmResults.length - 1 && "border-b border-film-border")}>
                <div className="relative shrink-0 w-9 h-[52px] rounded-lg overflow-hidden bg-film-border">
                  {r.poster_path
                    ? <img src={getImageUrl(r.poster_path, 'w92') || ''} alt={getEnglishTitle(r)} className={cn("w-full h-full object-cover", watchedIds.has(r.id) && "opacity-40 grayscale")} />
                    : <div className="w-full h-full flex items-center justify-center text-xs">{r.media_type === 'tv' ? '📺' : '🎬'}</div>
                  }
                  {watchedIds.has(r.id) && (
                    <div className="absolute inset-0 flex items-end justify-center pb-0.5">
                      <span className="text-green-400 text-[8px] font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{getEnglishTitle(r)}</p>
                  {getOriginalTitle(r) && <p className="text-film-subtle text-xs truncate">{getOriginalTitle(r)}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-film-subtle text-xs">{r.media_type === 'tv' ? 'Serie TV' : 'Film'}</span>
                    {getReleaseDate(r) && <span className="text-film-muted text-xs">{formatYear(getReleaseDate(r))}</span>}
                    {r.vote_average > 0 && (
                      <span className="flex items-center gap-0.5 text-film-accent text-xs">
                        <Star size={9} fill="currentColor" />{formatRating(r.vote_average)}
                      </span>
                    )}
                    {watchlistIds.has(r.id) && !watchedIds.has(r.id) && <span className="text-purple-400 text-xs">🔖</span>}
                  </div>
                </div>
                <ChevronRight size={14} className="text-film-subtle shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* People results */}
        {tab === 'people' && peopleResults.length > 0 && (
          <div className="mb-4">
            <p className="text-film-subtle text-xs uppercase tracking-wider mb-2">Persone</p>
            <div className="rounded-2xl overflow-hidden border border-film-border bg-film-card">
              {peopleResults.map((p, i) => (
                <button key={p.id} onClick={() => setOpenPerson({ id: p.id, name: p.name })}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface transition-colors text-left", i < peopleResults.length - 1 && "border-b border-film-border")}>
                  <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-film-surface border border-film-border">
                    {p.profile_path
                      ? <img src={getImageUrl(p.profile_path, 'w92') || ''} alt={p.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-film-subtle font-display text-sm">{p.name[0]}</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-film-text text-sm font-medium truncate">{p.name}</p>
                    <p className="text-film-subtle text-xs">{p.known_for_department}</p>
                  </div>
                  <ChevronRight size={14} className="text-film-subtle shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Company results */}
        {tab === 'people' && companyResults.length > 0 && (
          <div>
            <p className="text-film-subtle text-xs uppercase tracking-wider mb-2">Studios & Produzioni</p>
            <div className="rounded-2xl overflow-hidden border border-film-border bg-film-card">
              {companyResults.map((co, i) => (
                <button key={co.id} onClick={() => setOpenCompany(co)}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface transition-colors text-left", i < companyResults.length - 1 && "border-b border-film-border")}>
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-film-border p-1">
                    {co.logo_path
                      ? <img src={getProviderLogoUrl(co.logo_path)} alt={co.name} className="w-full h-full object-contain" />
                      : <Building2 size={16} className="text-film-muted" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-film-text text-sm font-medium truncate">{co.name}</p>
                    {co.origin_country && <p className="text-film-subtle text-xs">{co.origin_country}</p>}
                  </div>
                  <ChevronRight size={14} className="text-film-subtle shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Overlays */}
      {openMovie && (
        <InnerMovieDetail
          id={openMovie.id} mediaType={openMovie.mediaType}
          watchedIds={watchedIds} watchlistIds={watchlistIds} likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched} onUnmarkWatched={onUnmarkWatched}
          onUpdateRating={onUpdateRating} onToggleLiked={onToggleLiked}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlist} onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setOpenMovie(null)}
        />
      )}
      {openPerson && (
        <div className="fixed inset-0 z-[95]">
          <PersonDetailScreen
            personId={openPerson.id} personName={openPerson.name}
            watchedIds={watchedIds} watchlistIds={watchlistIds} likedIds={likedIds}
            getPersonalRating={getPersonalRating}
            onMarkWatched={onMarkWatched} onUnmarkWatched={onUnmarkWatched}
            onToggleLiked={onToggleLiked}
            onAddToWatchlist={onAddToWatchlist} onRemoveFromWatchlist={onRemoveFromWatchlist}
            onBack={() => setOpenPerson(null)}
            onOpenMovie={(id, mt) => setOpenMovie({ id, mediaType: mt })}
          />
        </div>
      )}
      {openCompany && (
        <CompanyMoviesScreen
          company={openCompany}
          watchedIds={watchedIds} watchlistIds={watchlistIds} likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched} onUnmarkWatched={onUnmarkWatched}
          onUpdateRating={onUpdateRating} onToggleLiked={onToggleLiked}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlist} onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setOpenCompany(null)}
        />
      )}
    </div>
  );
}
