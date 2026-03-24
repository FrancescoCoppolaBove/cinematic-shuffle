/**
 * ListFilterBar — barra filtri universale per tutte le liste film.
 * 
 * Due livelli:
 * 1. API filters: sort, media type, release status, genre, year, country, language, rating, service
 *    → quando cambiano, triggera un re-fetch
 * 2. Client filters: watched, liked, watchlist, rated, fade watched
 *    → filtrano i risultati già caricati senza re-fetch
 */
import { useState } from 'react';
import {
  SlidersHorizontal, X, ChevronDown, Search, LayoutGrid, Rows3,
} from 'lucide-react';
import { cn } from '../utils';
import { TMDB_MOVIE_GENRES, COMMON_LANGUAGES, COMMON_COUNTRIES } from '../types';
import { getPopularProviders } from '../services/tmdb';

export interface ApiFilters {
  sortBy: string;           // TMDB sort_by param
  mediaType: 'movie' | 'tv' | 'all';
  releaseStatus: 'released' | 'upcoming' | 'any';
  genreId?: number;
  year?: number;
  language?: string;
  originCountry?: string;
  minRating?: number;
  providerId?: number;
}

export interface ClientFilters {
  search: string;
  fadeWatched: boolean;
  watchedStatus: 'any' | 'watched' | 'unwatched';
  likedStatus: 'any' | 'liked' | 'not_liked';
  watchlistStatus: 'any' | 'watchlist' | 'not_watchlist';
  ratedStatus: 'any' | 'rated' | 'not_rated';
}

export const DEFAULT_API_FILTERS: ApiFilters = {
  sortBy: 'popularity.desc',
  mediaType: 'movie',
  releaseStatus: 'any',
};

export const DEFAULT_CLIENT_FILTERS: ClientFilters = {
  search: '',
  fadeWatched: false,
  watchedStatus: 'any',
  likedStatus: 'any',
  watchlistStatus: 'any',
  ratedStatus: 'any',
};

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular (All Time)' },
  { value: 'popularity_week.desc', label: 'Most Popular This Week' },
  { value: 'title.asc', label: 'Film Name (A–Z)' },
  { value: 'title.desc', label: 'Film Name (Z–A)' },
  { value: 'primary_release_date.desc', label: 'Newest First' },
  { value: 'primary_release_date.asc', label: 'Oldest First' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'vote_average.asc', label: 'Lowest Rated' },
  { value: 'runtime.asc', label: 'Shortest Films' },
  { value: 'runtime.desc', label: 'Longest Films' },
  { value: 'revenue.desc', label: 'Highest Box Office' },
];

interface ListFilterBarProps {
  apiFilters: ApiFilters;
  clientFilters: ClientFilters;
  onApiFiltersChange: (f: ApiFilters) => void;
  onClientFiltersChange: (f: ClientFilters) => void;
  viewMode: 'grid' | 'card';
  onViewModeChange: (m: 'grid' | 'card') => void;
  totalCount?: number;
  filteredCount?: number;
}

export function ListFilterBar({
  apiFilters, clientFilters,
  onApiFiltersChange, onClientFiltersChange,
  viewMode, onViewModeChange,
  totalCount, filteredCount,
}: ListFilterBarProps) {
  const [open, setOpen] = useState(false);
  const providers = getPopularProviders();

  const apiActive = [
    apiFilters.sortBy !== 'popularity.desc',
    apiFilters.mediaType !== 'movie',
    apiFilters.releaseStatus !== 'any',
    apiFilters.genreId,
    apiFilters.year,
    apiFilters.language,
    apiFilters.originCountry,
    apiFilters.minRating,
    apiFilters.providerId,
  ].filter(Boolean).length;

  const clientActive = [
    clientFilters.search,
    clientFilters.fadeWatched,
    clientFilters.watchedStatus !== 'any',
    clientFilters.likedStatus !== 'any',
    clientFilters.watchlistStatus !== 'any',
    clientFilters.ratedStatus !== 'any',
  ].filter(Boolean).length;

  const totalActive = apiActive + clientActive;

  function resetAll() {
    onApiFiltersChange(DEFAULT_API_FILTERS);
    onClientFiltersChange(DEFAULT_CLIENT_FILTERS);
  }

  return (
    <div className="bg-film-black border-b border-film-border">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Search */}
        <div className="flex-1 flex items-center gap-2 bg-film-surface border border-film-border rounded-xl px-3 py-1.5 focus-within:border-film-accent/60 transition-colors">
          <Search size={13} className="text-film-subtle shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={clientFilters.search}
            onChange={e => onClientFiltersChange({ ...clientFilters, search: e.target.value })}
            autoComplete="off"
            style={{ fontSize: '16px' }}
            className="flex-1 bg-transparent text-film-text placeholder:text-film-subtle text-sm focus:outline-none min-w-0"
          />
          {clientFilters.search && (
            <button onClick={() => onClientFiltersChange({ ...clientFilters, search: '' })} className="active:opacity-60">
              <X size={12} className="text-film-muted" />
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all active:opacity-70 shrink-0',
            totalActive > 0 || open
              ? 'bg-film-accent text-film-black border-film-accent'
              : 'bg-film-surface text-film-muted border-film-border'
          )}
        >
          <SlidersHorizontal size={13} />
          {totalActive > 0 ? `Filtri (${totalActive})` : 'Filtri'}
        </button>

        {/* View mode */}
        <button
          onClick={() => onViewModeChange(viewMode === 'grid' ? 'card' : 'grid')}
          className="w-8 h-8 rounded-xl bg-film-surface border border-film-border flex items-center justify-center active:opacity-60 shrink-0"
        >
          {viewMode === 'grid'
            ? <Rows3 size={14} className="text-film-muted" />
            : <LayoutGrid size={14} className="text-film-muted" />}
        </button>
      </div>

      {/* Count */}
      {(totalCount !== undefined && filteredCount !== undefined && filteredCount < totalCount) && (
        <div className="px-4 pb-1.5 text-film-subtle text-xs">
          {filteredCount} di {totalCount} risultati
        </div>
      )}

      {/* Expanded filter panel — scrollable */}
      {open && (
        <div className="overflow-y-auto border-t border-film-border" style={{ maxHeight: "60vh", overscrollBehavior: "contain" }}>
          <div className="px-4 pb-4 space-y-4 pt-3">

          {/* Sort By */}
          <FilterRow label="Sort By">
            <div className="relative">
              <select
                value={apiFilters.sortBy}
                onChange={e => onApiFiltersChange({ ...apiFilters, sortBy: e.target.value })}
                className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text appearance-none focus:outline-none focus:border-film-accent"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-film-muted pointer-events-none" />
            </div>
          </FilterRow>

          {/* Media Type */}
          <FilterRow label="Type">
            <div className="flex gap-2">
              {(['any', 'movie', 'tv'] as const).map(t => (
                <button key={t} onClick={() => onApiFiltersChange({ ...apiFilters, mediaType: t === 'any' ? 'movie' : t })}
                  className={cn('flex-1 py-1.5 rounded-xl text-xs border capitalize',
                    (t === 'any' ? apiFilters.mediaType === 'movie' && !apiFilters.mediaType : apiFilters.mediaType === t)
                      || (t === 'any' && apiFilters.mediaType === 'movie')
                      ? '' : '',
                    apiFilters.mediaType === t || (t === 'any' && !['movie','tv'].includes(apiFilters.mediaType))
                      ? 'bg-film-accent text-film-black border-film-accent'
                      : 'bg-film-card border-film-border text-film-muted'
                  )}>
                  {t === 'any' ? 'Any' : t === 'movie' ? 'Film' : 'TV'}
                </button>
              ))}
            </div>
          </FilterRow>

          {/* Release Status */}
          <FilterRow label="Released">
            <div className="flex gap-2">
              {(['any', 'released', 'upcoming'] as const).map(s => (
                <button key={s} onClick={() => onApiFiltersChange({ ...apiFilters, releaseStatus: s })}
                  className={cn('flex-1 py-1.5 rounded-xl text-xs border capitalize',
                    apiFilters.releaseStatus === s
                      ? 'bg-film-accent text-film-black border-film-accent'
                      : 'bg-film-card border-film-border text-film-muted'
                  )}>
                  {s === 'any' ? 'Any' : s === 'released' ? 'Released' : 'Upcoming'}
                </button>
              ))}
            </div>
          </FilterRow>

          {/* Genre */}
          <FilterRow label="Genre">
            <div className="relative">
              <select
                value={apiFilters.genreId ?? ''}
                onChange={e => onApiFiltersChange({ ...apiFilters, genreId: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text appearance-none focus:outline-none focus:border-film-accent"
              >
                <option value="">Any genre</option>
                {TMDB_MOVIE_GENRES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-film-muted pointer-events-none" />
            </div>
          </FilterRow>

          {/* Year */}
          <FilterRow label="Year">
            <input
              type="number"
              min={1870} max={new Date().getFullYear() + 2}
              placeholder="Any year"
              value={apiFilters.year ?? ''}
              onChange={e => onApiFiltersChange({ ...apiFilters, year: e.target.value ? Number(e.target.value) : undefined })}
              style={{ fontSize: '16px' }}
              className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text placeholder:text-film-subtle focus:outline-none focus:border-film-accent"
            />
          </FilterRow>

          {/* Language */}
          <FilterRow label="Language">
            <div className="relative">
              <select
                value={apiFilters.language ?? ''}
                onChange={e => onApiFiltersChange({ ...apiFilters, language: e.target.value || undefined })}
                className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text appearance-none focus:outline-none focus:border-film-accent"
              >
                <option value="">Any language</option>
                {COMMON_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-film-muted pointer-events-none" />
            </div>
          </FilterRow>

          {/* Country */}
          <FilterRow label="Country">
            <div className="relative">
              <select
                value={apiFilters.originCountry ?? ''}
                onChange={e => onApiFiltersChange({ ...apiFilters, originCountry: e.target.value || undefined })}
                className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text appearance-none focus:outline-none focus:border-film-accent"
              >
                <option value="">Any country</option>
                {COMMON_COUNTRIES.map(co => <option key={co.code} value={co.code}>{co.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-film-muted pointer-events-none" />
            </div>
          </FilterRow>

          {/* IMDB Rating */}
          <FilterRow label={`IMDB Rating${apiFilters.minRating ? ` ≥ ${apiFilters.minRating}` : ''}`}>
            <input
              type="range" min={0} max={9} step={0.5}
              value={apiFilters.minRating ?? 0}
              onChange={e => onApiFiltersChange({ ...apiFilters, minRating: Number(e.target.value) || undefined })}
              className="w-full accent-film-accent"
            />
            <div className="flex justify-between text-xs text-film-subtle mt-1">
              <span>Any</span><span>3</span><span>6</span><span>9</span>
            </div>
          </FilterRow>

          {/* Service */}
          <FilterRow label="Service">
            <div className="flex flex-wrap gap-1.5">
              {providers.map(p => (
                <button key={p.provider_id}
                  onClick={() => onApiFiltersChange({ ...apiFilters, providerId: apiFilters.providerId === p.provider_id ? undefined : p.provider_id })}
                  className={cn('flex items-center gap-1.5 px-2 py-1 rounded-xl border text-xs',
                    apiFilters.providerId === p.provider_id
                      ? 'bg-film-accent text-film-black border-film-accent'
                      : 'bg-film-card border-film-border text-film-muted'
                  )}
                >
                  <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} className="w-4 h-4 rounded-sm" />
                  {p.provider_name}
                </button>
              ))}
            </div>
          </FilterRow>

          {/* ── Client-side filters ── */}
          <div className="border-t border-film-border/50 pt-3">
            <p className="text-film-subtle text-xs uppercase tracking-wider mb-3">Your Library</p>

            {/* Fade Watched */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-film-text text-sm">Fade watched</span>
              <button onClick={() => onClientFiltersChange({ ...clientFilters, fadeWatched: !clientFilters.fadeWatched })}
                className={cn('relative w-11 h-6 rounded-full transition-colors', clientFilters.fadeWatched ? 'bg-film-accent' : 'bg-film-border')}>
                <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', clientFilters.fadeWatched ? 'translate-x-5' : '')} />
              </button>
            </div>

            {/* Tri-state filters */}
            {[
              { key: 'watchedStatus', label: 'Watched', opts: ['any','watched','unwatched'] as const },
              { key: 'likedStatus', label: 'Liked', opts: ['any','liked','not_liked'] as const },
              { key: 'watchlistStatus', label: 'Watchlist', opts: ['any','watchlist','not_watchlist'] as const },
              { key: 'ratedStatus', label: 'Rated', opts: ['any','rated','not_rated'] as const },
            ].map(({ key, label, opts }) => (
              <div key={key} className="flex items-center justify-between mb-2.5">
                <span className="text-film-text text-sm shrink-0">{label}</span>
                <div className="flex gap-1">
                  {opts.map(opt => (
                    <button key={opt}
                      onClick={() => onClientFiltersChange({ ...clientFilters, [key]: opt })}
                      className={cn('px-2.5 py-1 rounded-lg text-xs border capitalize',
                        (clientFilters as unknown as Record<string, string>)[key] === opt
                          ? 'bg-film-accent text-film-black border-film-accent'
                          : 'bg-film-card border-film-border text-film-muted'
                      )}>
                      {opt.replace(/_/g, ' ').replace('not ', '✗ ').replace('any', 'Any')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Reset */}
          {totalActive > 0 && (
            <button onClick={resetAll}
              className="w-full py-2 text-film-red text-sm border border-film-red/30 rounded-xl">
              Reset all filters
            </button>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-film-subtle text-xs uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}
