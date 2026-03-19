import { useState } from 'react';
import { SlidersHorizontal, X, LayoutGrid, Rows3 } from 'lucide-react';
import { cn } from '../utils';

export type ViewMode = 'grid' | 'card';

export interface GridFilters {
  search: string;
  mediaType: 'all' | 'movie' | 'tv';
  minRating: number;          // 0 = qualsiasi
  onlyRated: boolean;         // solo quelli con voto personale
  sortBy: 'date' | 'rating' | 'title' | 'tmdb_rating';
}

export const DEFAULT_GRID_FILTERS: GridFilters = {
  search: '',
  mediaType: 'all',
  minRating: 0,
  onlyRated: false,
  sortBy: 'date',
};

interface GridControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  filters: GridFilters;
  onFiltersChange: (f: GridFilters) => void;
  showRatingFilter?: boolean;   // mostra "Solo votati" solo nella vista Visti
  totalCount: number;
  filteredCount: number;
}

export function GridControls({
  viewMode, onViewModeChange,
  filters, onFiltersChange,
  showRatingFilter = false,
  totalCount, filteredCount,
}: GridControlsProps) {
  const [showPanel, setShowPanel] = useState(false);

  const activeCount = [
    filters.mediaType !== 'all',
    filters.minRating > 0,
    filters.onlyRated,
    filters.sortBy !== 'date',
  ].filter(Boolean).length;

  function reset() {
    onFiltersChange({ ...DEFAULT_GRID_FILTERS, search: filters.search });
  }

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Cerca..."
          value={filters.search}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
          className="flex-1 bg-film-surface border border-film-border rounded-xl px-3 py-2 text-sm text-film-text placeholder:text-film-subtle focus:outline-none focus:border-film-accent transition-colors"
        />

        {/* Filter button */}
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-all active:scale-95',
            showPanel || activeCount > 0
              ? 'bg-film-accent/10 border-film-accent text-film-accent'
              : 'bg-film-surface border-film-border text-film-muted hover:text-film-text'
          )}
        >
          {showPanel ? <X size={15} /> : <SlidersHorizontal size={15} />}
          {activeCount > 0 && (
            <span className="bg-film-accent text-film-black text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        {/* View mode toggle */}
        <div className="flex bg-film-surface border border-film-border rounded-xl overflow-hidden">
          <button
            onClick={() => onViewModeChange('grid')}
            className={cn(
              'p-2 transition-colors',
              viewMode === 'grid' ? 'bg-film-accent text-film-black' : 'text-film-muted hover:text-film-text'
            )}
            title="Griglia"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => onViewModeChange('card')}
            className={cn(
              'p-2 transition-colors',
              viewMode === 'card' ? 'bg-film-accent text-film-black' : 'text-film-muted hover:text-film-text'
            )}
            title="Card"
          >
            <Rows3 size={15} />
          </button>
        </div>
      </div>

      {/* Counter */}
      {(activeCount > 0 || filters.search) && (
        <p className="text-film-subtle text-xs">
          {filteredCount} di {totalCount} risultati
        </p>
      )}

      {/* Filter panel */}
      {showPanel && (
        <div className="bg-film-surface border border-film-border rounded-2xl p-4 space-y-4 animate-slide-up">
          {/* Tipo */}
          <div className="space-y-2">
            <label className="text-film-subtle text-xs uppercase tracking-wider">Tipo</label>
            <div className="flex gap-2">
              {([
                { value: 'all', label: 'Tutti' },
                { value: 'movie', label: 'Film' },
                { value: 'tv', label: 'Serie TV' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onFiltersChange({ ...filters, mediaType: opt.value })}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                    filters.mediaType === opt.value
                      ? 'bg-film-accent text-film-black border-film-accent'
                      : 'bg-film-card border-film-border text-film-muted'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voto TMDB minimo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-film-subtle text-xs uppercase tracking-wider">Voto minimo TMDB</label>
              <span className={cn(
                'font-mono font-bold text-sm',
                filters.minRating > 0 ? 'text-film-accent' : 'text-film-subtle'
              )}>
                {filters.minRating > 0 ? `≥ ${filters.minRating.toFixed(1)}` : 'Qualsiasi'}
              </span>
            </div>
            <input
              type="range"
              min={0} max={9} step={0.5}
              value={filters.minRating}
              onChange={e => onFiltersChange({ ...filters, minRating: parseFloat(e.target.value) })}
              className="w-full accent-film-accent"
            />
            <div className="flex justify-between text-film-subtle text-xs">
              <span>0</span><span>3</span><span>6</span><span>9</span>
            </div>
          </div>

          {/* Solo votati */}
          {showRatingFilter && (
            <div className="flex items-center justify-between">
              <label className="text-film-text text-sm">Solo con voto personale</label>
              <button
                onClick={() => onFiltersChange({ ...filters, onlyRated: !filters.onlyRated })}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  filters.onlyRated ? 'bg-film-accent' : 'bg-film-border'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                  filters.onlyRated ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          )}

          {/* Ordina per */}
          <div className="space-y-2">
            <label className="text-film-subtle text-xs uppercase tracking-wider">Ordina per</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'date', label: 'Data aggiunta' },
                { value: 'title', label: 'Titolo A-Z' },
                { value: 'tmdb_rating', label: 'Voto TMDB' },
                { value: 'rating', label: 'Voto personale' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onFiltersChange({ ...filters, sortBy: opt.value })}
                  className={cn(
                    'py-2 px-3 rounded-xl text-xs font-medium border transition-all text-left',
                    filters.sortBy === opt.value
                      ? 'bg-film-accent text-film-black border-film-accent'
                      : 'bg-film-card border-film-border text-film-muted'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          {activeCount > 0 && (
            <button
              onClick={reset}
              className="w-full py-2 text-film-red text-sm border border-film-red/30 rounded-xl hover:bg-film-red/10 transition-colors"
            >
              Reset filtri
            </button>
          )}
        </div>
      )}
    </div>
  );
}
