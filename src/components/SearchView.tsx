/**
 * SearchView — con Browse By (stile Letterboxd) + ricerche recenti.
 *
 * STATI:
 * - Focus su input → mostra ricerche recenti (se presenti) + risultati live
 * - Nessun focus, nessuna query → mostra Browse By
 */
import { useState, useRef } from 'react';
import { Search, X, Star, ChevronRight, Building2, Clock, Film, Calendar,
         Globe, Tv, TrendingUp, Award, Gem, BookOpen } from 'lucide-react';
import type { TMDBMovieBasic, TMDBMovieDetail, SearchResult } from '../types';
import {
  searchPeople, searchCompanies, searchMoviesOnly, searchTVOnly,
  getImageUrl, getEnglishTitle, getOriginalTitle, getReleaseDate,
  getProviderLogoUrl, getPopularProviders,
} from '../services/tmdb';
import type { PersonSearchResult, CompanySearchResult } from '../services/tmdb';
import { TMDB_MOVIE_GENRES, COMMON_LANGUAGES, COMMON_COUNTRIES } from '../types';
import { formatYear, formatRating, cn } from '../utils';
import { InnerMovieDetail } from './InnerMovieDetail';
import { PersonDetailScreen } from './PersonDetailScreen';
import { BrowseListScreen } from './BrowseListScreen';
import type { BrowseSource } from './BrowseListScreen';

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
  onCardQuickView?: (movie: TMDBMovieBasic, mediaType: 'movie' | 'tv') => void;
}

type SearchTab = 'films' | 'tv' | 'people';
type BrowseSection = 'date' | 'genre_country_lang' | 'service' | null;
type GenreTab = 'genre' | 'country' | 'language';

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
  localStorage.setItem(RECENT_KEY, JSON.stringify([{ query, tab, ts: Date.now() }, ...prev].slice(0, MAX_RECENT)));
}
function clearRecent() { localStorage.removeItem(RECENT_KEY); }

// Decadi per Browse By Release Date
const BROWSE_DECADES = [
  '1870s','1880s','1890s','1900s','1910s','1920s','1930s','1940s',
  '1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s',
];

export function SearchView({
  watchedIds, watchlistIds, likedIds = new Set(),
  getPersonalRating, onMarkWatched, onUnmarkWatched, onUpdateRating,
  onToggleLiked, onIncrementRewatch, onAddToWatchlist, onRemoveFromWatchlist,
  onOpenMovieGlobal: _onOpenMovieGlobal,
  onCardQuickView,
}: SearchViewProps) {
  const [tab, setTab] = useState<SearchTab>('films');
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [filmResults, setFilmResults] = useState<SearchResult[]>([]);
  const [peopleResults, setPeopleResults] = useState<PersonSearchResult[]>([]);
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentSearch[]>(loadRecent);
  // Browse by state
  const [browseSection, setBrowseSection] = useState<BrowseSection>(null);
  const [selectedDecade, setSelectedDecade] = useState<string | null>(null);
  const [genreTab, setGenreTab] = useState<GenreTab>('genre');
  // Overlays
  const [openPerson, setOpenPerson] = useState<{ id: number; name: string } | null>(null);
  const [openMovie, setOpenMovie] = useState<{ id: number; mediaType: 'movie' | 'tv' } | null>(null);
  const [browseSource, setBrowseSource] = useState<BrowseSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasResults = tab === 'people' ? (peopleResults.length > 0 || companyResults.length > 0) : filmResults.length > 0;
  const showSearch = isFocused || !!query;
  const showBrowse = !showSearch;

  async function doSearch(q: string, t: SearchTab) {
    if (!q.trim()) { setFilmResults([]); setPeopleResults([]); setCompanyResults([]); return; }
    setLoading(true);
    try {
      if (t === 'films') { setFilmResults(await searchMoviesOnly(q)); }
      else if (t === 'tv') { setFilmResults(await searchTVOnly(q)); }
      else {
        const [people, companies] = await Promise.all([searchPeople(q), searchCompanies(q)]);
        setPeopleResults(people); setCompanyResults(companies);
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
    // Keep focus on input when switching tabs
    setTimeout(() => inputRef.current?.focus(), 0);
    if (query.trim()) setTimeout(() => doSearch(query, t), 100);
  }

  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleFocus() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setIsFocused(true);
  }

  function handleBlur() {
    // Delay to let tap targets register; cancelled if focus returns immediately
    blurTimerRef.current = setTimeout(() => setIsFocused(false), 200);
  }

  function handleCancel() {
    setQuery('');
    setFilmResults([]); setPeopleResults([]); setCompanyResults([]);
    setIsFocused(false);
    inputRef.current?.blur();
  }

  function handleSelectFilm(id: number, mediaType: 'movie' | 'tv') {
    saveRecent(query, tab === 'tv' ? 'tv' : 'films'); setRecent(loadRecent());
    setOpenMovie({ id, mediaType });
  }

  function handleSelectPerson(id: number, name: string) {
    saveRecent(query, 'people'); setRecent(loadRecent());
    setOpenPerson({ id, name });
  }

  function handleSelectCompany(co: CompanySearchResult) {
    saveRecent(query, 'people'); setRecent(loadRecent());
    setBrowseSource({ type: 'provider', id: co.id, name: co.name, logoPath: co.logo_path });
  }

  function handleSelectRecent(r: RecentSearch) {
    setQuery(r.query); setTab(r.tab); setIsFocused(true);
    doSearch(r.query, r.tab);
  }

  function openBrowse(source: BrowseSource) {
    setIsFocused(false);
    setBrowseSource(source);
  }

  const tabLabel: Record<SearchTab, string> = { films: 'Films', tv: 'TV Shows', people: 'Cast, Crew & Studios' };
  const providers = getPopularProviders().slice(0, 12);

  return (
    <div className="flex flex-col h-full">
      {/* ── Search bar ── */}
      <div className="px-4 pt-5 pb-0 bg-film-black shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-film-surface border border-film-border rounded-xl px-3 py-2 focus-within:border-film-accent/60 transition-colors">
            {loading
              ? <div className="w-4 h-4 border-2 border-film-accent border-t-transparent rounded-full animate-spin shrink-0" />
              : <Search size={15} className="text-film-subtle shrink-0" />}
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              placeholder={tab === 'films' ? 'Find films...' : tab === 'tv' ? 'Find TV shows...' : 'Find cast, crew or studios...'}
              value={query}
              onChange={e => handleInput(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              style={{ fontSize: '16px' }}
              className="flex-1 bg-transparent text-film-text placeholder:text-film-subtle leading-tight focus:outline-none"
            />
            {query && (
              <button onMouseDown={e => e.preventDefault()} onClick={() => { setQuery(''); setFilmResults([]); setPeopleResults([]); setCompanyResults([]); }} className="active:opacity-60 shrink-0">
                <X size={14} className="text-film-muted" />
              </button>
            )}
          </div>
          {showSearch && (
            <button onMouseDown={e => e.preventDefault()} onClick={handleCancel} className="text-film-accent text-sm active:opacity-60 shrink-0">
              Cancel
            </button>
          )}
        </div>

        {/* Tabs — only when focused */}
        {showSearch && (
          <div className="flex gap-0 mt-3 border-b border-film-border">
            {(['films', 'tv', 'people'] as SearchTab[]).map(t => (
              <button key={t}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleTabChange(t)}
                className={cn('px-4 py-2.5 text-sm font-medium transition-colors relative shrink-0',
                  tab === t ? 'text-film-text' : 'text-film-muted')}>
                {tabLabel[t]}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-film-accent rounded-full" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>

        {/* ── SEARCH MODE ── */}
        {showSearch && (
          <>
            {/* Recent searches (when no query) */}
            {!query && recent.length > 0 && (
              <div className="pt-4">
                <div className="flex items-center justify-between px-4 mb-2">
                  <span className="text-film-subtle text-xs uppercase tracking-wider font-medium">Recent Searches</span>
                  <button onClick={() => { clearRecent(); setRecent([]); }} className="text-film-muted text-xs active:opacity-60">Clear</button>
                </div>
                {recent.map((r, i) => (
                  <button key={i} onClick={() => handleSelectRecent(r)}
                    className="w-full flex items-center justify-between px-4 py-3 active:bg-film-surface/50 border-b border-film-border/40 last:border-0">
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

            {/* Film results */}
            {(tab === 'films' || tab === 'tv') && filmResults.length > 0 && (
              <div className="pt-2">
                {filmResults.map((r, i) => (
                  <button key={r.id} onClick={() => handleSelectFilm(r.id, r.media_type)}
                    className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 text-left", i < filmResults.length - 1 && "border-b border-film-border/40")}>
                    <div className="relative shrink-0 w-9 h-[52px] rounded-md overflow-hidden bg-film-surface">
                      {r.poster_path
                        ? <img src={getImageUrl(r.poster_path, 'w92') || ''} alt={getEnglishTitle(r)} className={cn("w-full h-full object-cover", watchedIds.has(r.id) && "opacity-40 grayscale")} />
                        : <div className="w-full h-full flex items-center justify-center text-xs">{r.media_type === 'tv' ? '📺' : '🎬'}</div>}
                      {watchedIds.has(r.id) && <div className="absolute inset-0 flex items-end justify-center pb-0.5"><span className="text-green-400 text-[8px] font-bold">✓</span></div>}
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
                <p className="text-film-subtle text-xs uppercase tracking-wider px-4 py-2">People</p>
                {peopleResults.map((p, i) => (
                  <button key={p.id} onClick={() => handleSelectPerson(p.id, p.name)}
                    className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 text-left", i < peopleResults.length - 1 && "border-b border-film-border/40")}>
                    <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-film-surface border border-film-border">
                      {p.profile_path ? <img src={getImageUrl(p.profile_path, 'w92') || ''} alt={p.name} className="w-full h-full object-cover" />
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

            {tab === 'people' && companyResults.length > 0 && (
              <div className={cn("pt-2", peopleResults.length > 0 && "mt-2")}>
                <p className="text-film-subtle text-xs uppercase tracking-wider px-4 py-2">Studios</p>
                {companyResults.map((co, i) => (
                  <button key={co.id} onClick={() => handleSelectCompany(co)}
                    className={cn("w-full flex items-center gap-3 px-4 py-3 active:bg-film-surface/50 text-left", i < companyResults.length - 1 && "border-b border-film-border/40")}>
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden p-1">
                      {co.logo_path ? <img src={getProviderLogoUrl(co.logo_path)} alt={co.name} className="w-full h-full object-contain" />
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

            {query && !loading && !hasResults && (
              <div className="flex flex-col items-center justify-center py-16 text-film-muted">
                <p className="text-sm">No results for "{query}"</p>
              </div>
            )}
          </>
        )}

        {/* ── BROWSE BY MODE ── */}
        {showBrowse && (
          <div className="pt-4 pb-24">
            <p className="text-film-text font-semibold px-4 mb-3">Browse by</p>

            {/* Top level browse items */}
            {!browseSection && (
              <div className="space-y-0">
                {/* Release Date */}
                <BrowseRow icon={<Calendar size={16} />} label="Release Date" onTap={() => setBrowseSection('date')} />
                {/* Genre, Country or Language */}
                <BrowseRow icon={<Globe size={16} />} label="Genre, Country or Language" onTap={() => setBrowseSection('genre_country_lang')} />
                {/* Service */}
                <BrowseRow icon={<Tv size={16} />} label="Service" onTap={() => setBrowseSection('service')} />

                <div className="my-3 border-t border-film-border/50" />

                {/* Most Popular */}
                <BrowseRow icon={<TrendingUp size={16} />} label="Most Popular"
                  onTap={() => openBrowse({ type: 'browse', title: 'Most Popular', filters: { sortBy: 'popularity.desc', minVoteCount: 100 } })} />
                {/* Highest Rated */}
                <BrowseRow icon={<Star size={16} />} label="Highest Rated"
                  onTap={() => openBrowse({ type: 'browse', title: 'Highest Rated', filters: { sortBy: 'vote_average.desc', minVoteCount: 1000, minRating: 7.0 } })} />
                {/* Most Anticipated */}
                <BrowseRow icon={<Film size={16} />} label="Most Anticipated"
                  onTap={() => openBrowse({ type: 'anticipated', title: 'Most Anticipated' } as BrowseSource)} />
                {/* Top 500 */}
                <BrowseRow icon={<Award size={16} />} label="Top 500 Narrative Features"
                  onTap={() => openBrowse({ type: 'top500' })} />
                {/* Hidden Gems */}
                <BrowseRow icon={<Gem size={16} />} label="Hidden Gems"
                  onTap={() => openBrowse({ type: 'hidden_gems' })} />
                {/* Great Classics */}
                <BrowseRow icon={<BookOpen size={16} />} label="Great Classics (70s–90s)"
                  onTap={() => openBrowse({ type: 'browse', title: 'Great Classics', filters: { sortBy: 'vote_average.desc', minVoteCount: 500, minRating: 7.5 } })} />
              </div>
            )}

            {/* Release Date drill-down */}
            {browseSection === 'date' && !selectedDecade && (
              <>
                <div className="flex items-center gap-2 px-4 mb-3">
                  <button onClick={() => setBrowseSection(null)} className="active:opacity-60">
                    <ChevronRight size={16} className="text-film-muted rotate-180" />
                  </button>
                  <span className="text-film-text font-medium">Release Date</span>
                </div>
                <BrowseRow icon={<Calendar size={15} />} label="Upcoming"
                  onTap={() => openBrowse({ type: 'upcoming' })} />
                {[...BROWSE_DECADES].reverse().map(decade => (
                  <BrowseRow key={decade} icon={<span className="text-film-muted text-xs font-mono">{decade}</span>} label={decade}
                    onTap={() => setSelectedDecade(decade)} hasChevron />
                ))}
              </>
            )}

            {/* Year drill-down within a decade */}
            {browseSection === 'date' && selectedDecade && (
              <>
                <div className="flex items-center gap-2 px-4 mb-3">
                  <button onClick={() => setSelectedDecade(null)} className="active:opacity-60">
                    <ChevronRight size={16} className="text-film-muted rotate-180" />
                  </button>
                  <span className="text-film-text font-medium">{selectedDecade}</span>
                </div>
                <BrowseRow icon={<span className="text-film-muted text-xs">All</span>} label={`All ${selectedDecade}`}
                  onTap={() => openBrowse({ type: 'browse', title: selectedDecade, filters: { decade: selectedDecade, sortBy: 'popularity.desc' } })} />
                {Array.from({ length: 10 }, (_, i) => {
                  const startYear = parseInt(selectedDecade);
                  const year = startYear + i;
                  const currentYear = new Date().getFullYear();
                  if (year > currentYear + 1) return null;
                  return (
                    <BrowseRow key={year} icon={<span className="text-film-muted text-xs font-mono">{year}</span>} label={String(year)}
                      onTap={() => openBrowse({ type: 'year', year, mediaType: 'movie' })} />
                  );
                })}
              </>
            )}

            {/* Genre, Country, Language */}
            {browseSection === 'genre_country_lang' && (
              <>
                <div className="flex items-center gap-2 px-4 mb-3">
                  <button onClick={() => setBrowseSection(null)} className="active:opacity-60">
                    <ChevronRight size={16} className="text-film-muted rotate-180" />
                  </button>
                  <span className="text-film-text font-medium">Genre, Country or Language</span>
                </div>
                {/* Sub-tabs */}
                <div className="flex px-4 gap-2 mb-4">
                  {(['genre', 'country', 'language'] as GenreTab[]).map(t => (
                    <button key={t} onClick={() => setGenreTab(t)}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-medium border capitalize transition-all',
                        genreTab === t ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-surface text-film-muted border-film-border')}>
                      {t}
                    </button>
                  ))}
                </div>
                {genreTab === 'genre' && TMDB_MOVIE_GENRES.map(g => (
                  <BrowseRow key={g.id} icon={<Film size={14} />} label={g.name}
                    onTap={() => openBrowse({ type: 'genre', id: g.id, mediaType: 'movie', title: g.name })} />
                ))}
                {genreTab === 'country' && COMMON_COUNTRIES.map(co => (
                  <BrowseRow key={co.code} icon={<Globe size={14} />} label={co.name}
                    onTap={() => openBrowse({ type: 'browse', title: co.name, filters: { originCountry: co.code, sortBy: 'popularity.desc' } })} />
                ))}
                {genreTab === 'language' && COMMON_LANGUAGES.map(l => (
                  <BrowseRow key={l.code} icon={<Globe size={14} />} label={l.name}
                    onTap={() => openBrowse({ type: 'browse', title: l.name, filters: { language: l.code, sortBy: 'popularity.desc' } })} />
                ))}
              </>
            )}

            {/* Service (providers) */}
            {browseSection === 'service' && (
              <>
                <div className="flex items-center gap-2 px-4 mb-3">
                  <button onClick={() => setBrowseSection(null)} className="active:opacity-60">
                    <ChevronRight size={16} className="text-film-muted rotate-180" />
                  </button>
                  <span className="text-film-text font-medium">Service</span>
                </div>
                {providers.map(p => (
                  <button key={p.provider_id}
                    onClick={() => openBrowse({ type: 'provider', id: p.provider_id, name: p.provider_name, logoPath: p.logo_path })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-film-border/40 last:border-0 active:bg-film-surface/50">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex items-center justify-center shrink-0 p-0.5">
                      <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-film-text text-sm font-medium">{p.provider_name}</span>
                    <ChevronRight size={13} className="text-film-subtle/50 ml-auto" />
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        <div className="h-8" />
      </div>

      {/* ── Overlays ── */}
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
      {browseSource && (
        <BrowseListScreen
          source={browseSource}
          watchedIds={watchedIds} watchlistIds={watchlistIds} likedIds={likedIds}
          getPersonalRating={getPersonalRating}
          onMarkWatched={onMarkWatched} onUnmarkWatched={onUnmarkWatched}
          onUpdateRating={onUpdateRating} onToggleLiked={onToggleLiked}
          onIncrementRewatch={onIncrementRewatch}
          onAddToWatchlist={onAddToWatchlist} onRemoveFromWatchlist={onRemoveFromWatchlist}
          onBack={() => setBrowseSource(null)}
          onCardQuickView={onCardQuickView}
          zIndex={95}
        />
      )}
    </div>
  );
}

function BrowseRow({ icon, label, onTap, hasChevron = true }: {
  icon: React.ReactNode; label: string; onTap: () => void; hasChevron?: boolean;
}) {
  return (
    <button onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-film-border/40 last:border-0 active:bg-film-surface/50 transition-colors text-left">
      <span className="text-film-accent shrink-0 w-5 flex justify-center">{icon}</span>
      <span className="text-film-text text-sm flex-1">{label}</span>
      {hasChevron && <ChevronRight size={14} className="text-film-subtle/50 shrink-0" />}
    </button>
  );
}
