/**
 * SearchView — stile Letterboxd.
 * - Input compatto senza padding extra (il main già gestisce l'offset header)
 * - font-size 16px sull'input per evitare lo zoom iOS
 * - Tab scrollabili: Films | Cast, Crew & Studios
 * - Ricerche recenti salvate in localStorage con badge categoria
 * - Risultati inline (no dropdown)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Star, ChevronRight, Building2, Clock } from 'lucide-react';
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

// ── Recent searches ───────────────────────────────────────────────
const RECENT_KEY = 'cs_recent_searches';
const MAX_RECENT = 12;

interface RecentSearch { query: string; tab: SearchTab; ts: number; }

function loadRecent(): RecentSearch[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(query: string, tab: SearchTab) {
  if (!query.trim()) return;
  const prev = loadRecent().filter(r => !(r.query === query && r.tab === tab));
  const next = [{ query, tab, ts: Date.now() }, ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}
function clearRecent() { localStorage.removeItem(RECENT_KEY); }

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

  const listRef = useRef<HTMLDivElement>(null);
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadMore();
  }, [loadMore]);

  return (
    <div className="fixed inset-0 z-[95] bg-film-black flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="shrink-0 bg-film-black/95 backdrop-blur-md border-b border-film-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="active:opacity-60">
            <div className="w-9 h-9 rounded-full bg-film-surface border border-film-border flex items-center justify-center">
              <X size={16} className="text-film-text" />
            </div>
          </button>
          {company.logo_path
            ? <img src={getProviderLogoUrl(company.logo_path)} alt={company.name} className="h-6 object-contain" />
            : <Building2 size={18} className="text-film-accent" />}
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
                  ? <img src={getImageUrl(m.poster_path, 'w342') || ''} alt={getEnglishTitle(m)}
                      className={cn("w-full h-full object-cover", watchedIds.has(m.id) && "opacity-40 grayscale")} />
                  : <div className="w-full h-full flex items-center justify-center text-xl">🎬</div>}
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
  const [recent, setRecent] = useState<RecentSearch[]>(loadRecent);
  const [openPerson, setOpenPerson] = useState<{ id: number; name: string } | null>(null);
  const [openCompany, setOpenCompany] = useState<CompanySearchResult | null>(null);
  const [openMovie, setOpenMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasResults = tab === 'films' ? filmResults.length > 0 : (peopleResults.length > 0 || companyResults.length > 0);

  async function doSearch(q: string, t: SearchTab) {
    if (!q.trim()) {
      setFilmResults([]); setPeopleResults([]); setCompanyResults([]);
      return;
    }
    setLoading(true);
    try {
      if (t === 'films') {
        const r = await searchContent(q);
        setFilmResults(r);
      } else {
        const [people, companies] = await Promise.all([searchPeople(q), searchCompanies(q)]);
        setPeopleResults(people);
        setCompanyResults(companies);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  function handleInput(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(q, tab), 350);
  }

  function handleTabChange(t: SearchTab) {
    setTab(t);
    if (query.trim()) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doSearch(query, t), 100);
    }
  }

  function handleSelectRecent(r: RecentSearch) {
    setQuery(r.query);
    setTab(r.tab);
    doSearch(r.query, r.tab);
  }

  function handleSelectFilm(id: number, mediaType: 'movie' | 'tv') {
    saveRecent(query, 'films');
    setRecent(loadRecent());
    setOpenMovie({ id, mediaType });
  }

  function handleSelectPerson(id: number, name: string) {
    saveRecent(query, 'people');
    setRecent(loadRecent());
    setOpenPerson({ id, name });
  }

  function handleSelectCompany(co: CompanySearchResult) {
    saveRecent(query, 'people');
    setRecent(loadRecent());
    setOpenCompany(co);
  }

  const tabLabel: Record<SearchTab, string> = { films: 'Films', people: 'Cast, Crew or Studios' };

  return (
    <div className="flex flex-col min-h-full -mt-4 -mx-4">
      {/* ── Search bar ── */}
      <div className="px-4 pt-4 pb-0 bg-film-black sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-film-surface border border-film-border rounded-xl px-3 py-2 focus-within:border-film-accent/60 transition-colors">
            {loading
              ? <div className="w-4 h-4 border-2 border-film-accent border-t-transparent rounded-full animate-spin shrink-0" />
              : <Search size={15} className="text-film-subtle shrink-0" />}
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              placeholder={tab === 'films' ? 'Find films, series...' : 'Find cast, crew or studios...'}
              value={query}
              onChange={e => handleInput(e.target.value)}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              // font-size >= 16px prevents iOS zoom
              style={{ fontSize: '16px' }}
              className="flex-1 bg-transparent text-film-text placeholder:text-film-subtle leading-tight focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setFilmResults([]); setPeopleResults([]); setCompanyResults([]); }} className="active:opacity-60 shrink-0">
                <X size={14} className="text-film-muted" />
              </button>
            )}
          </div>
          {query && (
            <button onClick={() => { setQuery(''); setFilmResults([]); setPeopleResults([]); setCompanyResults([]); inputRef.current?.blur(); }}
              className="text-film-accent text-sm active:opacity-60 shrink-0">
              Cancel
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0 mt-3 border-b border-film-border">
          {(['films', 'people'] as SearchTab[]).map(t => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors relative shrink-0',
                tab === t ? 'text-film-text' : 'text-film-muted'
              )}>
              {tabLabel[t]}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-film-accent rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Recent searches — shown when input is empty */}
        {!query && recent.length > 0 && (
          <div className="pt-4">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-film-subtle text-xs uppercase tracking-wider font-medium">Recent Searches</span>
              <button onClick={() => { clearRecent(); setRecent([]); }} className="text-film-muted text-xs active:opacity-60">Clear</button>
            </div>
            {recent.map((r, i) => (
              <button key={i} onClick={() => handleSelectRecent(r)}
                className="w-full flex items-center justify-between px-4 py-3 active:bg-film-surface/50 transition-colors border-b border-film-border/40 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock size={14} className="text-film-subtle shrink-0" />
                  <span className="text-film-text text-sm truncate">{r.query}</span>
                </div>
                <span className="text-film-subtle text-xs px-2 py-0.5 rounded-lg bg-film-surface border border-film-border shrink-0 ml-3">
                  {tabLabel[r.tab]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state — no query, no recent */}
        {!query && recent.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-film-muted">
            <Search size={36} className="mb-3 opacity-20" />
            <p className="text-sm">{tab === 'films' ? 'Search for films and series' : 'Search cast, crew or studios'}</p>
          </div>
        )}

        {/* Film results */}
        {tab === 'films' && filmResults.length > 0 && (
          <div className="pt-2">
            {filmResults.map((r, i) => (
              <button key={r.id} onClick={() => handleSelectFilm(r.id, r.media_type)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 transition-colors text-left",
                  i < filmResults.length - 1 && "border-b border-film-border/40"
                )}>
                <div className="relative shrink-0 w-9 h-[52px] rounded-md overflow-hidden bg-film-surface">
                  {r.poster_path
                    ? <img src={getImageUrl(r.poster_path, 'w92') || ''} alt={getEnglishTitle(r)}
                        className={cn("w-full h-full object-cover", watchedIds.has(r.id) && "opacity-40 grayscale")} />
                    : <div className="w-full h-full flex items-center justify-center text-xs">{r.media_type === 'tv' ? '📺' : '🎬'}</div>}
                  {watchedIds.has(r.id) && (
                    <div className="absolute inset-0 flex items-end justify-center pb-0.5">
                      <span className="text-green-400 text-[8px] font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{getEnglishTitle(r)}</p>
                  {getOriginalTitle(r) && <p className="text-film-subtle text-xs truncate">{getOriginalTitle(r)}</p>}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-film-subtle text-xs">{r.media_type === 'tv' ? 'Series' : 'Film'}</span>
                    {getReleaseDate(r) && <><span className="text-film-border text-xs">·</span><span className="text-film-muted text-xs">{formatYear(getReleaseDate(r))}</span></>}
                    {r.vote_average > 0 && <><span className="text-film-border text-xs">·</span><span className="flex items-center gap-0.5 text-film-accent text-xs"><Star size={9} fill="currentColor" />{formatRating(r.vote_average)}</span></>}
                  </div>
                </div>
                <ChevronRight size={13} className="text-film-subtle/50 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* People results */}
        {tab === 'people' && peopleResults.length > 0 && (
          <div className="pt-2">
            {peopleResults.length > 0 && (
              <p className="text-film-subtle text-xs uppercase tracking-wider px-4 py-2">People</p>
            )}
            {peopleResults.map((p, i) => (
              <button key={p.id} onClick={() => handleSelectPerson(p.id, p.name)}
                className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 transition-colors text-left",
                  i < peopleResults.length - 1 && "border-b border-film-border/40")}>
                <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-film-surface border border-film-border">
                  {p.profile_path
                    ? <img src={getImageUrl(p.profile_path, 'w92') || ''} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-film-subtle text-sm font-medium">{p.name[0]}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{p.name}</p>
                  <p className="text-film-subtle text-xs">{p.known_for_department}</p>
                </div>
                <ChevronRight size={13} className="text-film-subtle/50 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Company results */}
        {tab === 'people' && companyResults.length > 0 && (
          <div className={cn("pt-2", peopleResults.length > 0 && "mt-2")}>
            <p className="text-film-subtle text-xs uppercase tracking-wider px-4 py-2">Studios</p>
            {companyResults.map((co, i) => (
              <button key={co.id} onClick={() => handleSelectCompany(co)}
                className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 transition-colors text-left",
                  i < companyResults.length - 1 && "border-b border-film-border/40")}>
                <div className="shrink-0 w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden p-1">
                  {co.logo_path
                    ? <img src={getProviderLogoUrl(co.logo_path)} alt={co.name} className="w-full h-full object-contain" />
                    : <Building2 size={14} className="text-film-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{co.name}</p>
                  {co.origin_country && <p className="text-film-subtle text-xs">{co.origin_country}</p>}
                </div>
                <ChevronRight size={13} className="text-film-subtle/50 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {query && !loading && !hasResults && (
          <div className="flex flex-col items-center justify-center py-16 text-film-muted">
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}

        <div className="h-8" />
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
