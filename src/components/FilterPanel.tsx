import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Search, Star, Calendar, Clapperboard, User, Film } from 'lucide-react';
import type { MovieFilters } from '../types';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES, DECADES } from '../types';
import { searchPersons, getPopularProviders } from '../services/tmdb';
import { cn } from '../utils';

interface FilterPanelProps {
  filters: MovieFilters;
  onChange: (filters: MovieFilters) => void;
}

interface PersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [actorQuery, setActorQuery] = useState('');
  const [actorResults, setActorResults] = useState<PersonResult[]>([]);
  const [actorLoading, setActorLoading] = useState(false);
  const [directorQuery, setDirectorQuery] = useState(filters.directorName || '');
  const [showActorDropdown, setShowActorDropdown] = useState(false);
  const actorRef = useRef<HTMLDivElement>(null);
  const actorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actorRef.current && !actorRef.current.contains(e.target as Node)) {
        setShowActorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleActorSearch(q: string) {
    setActorQuery(q);
    if (actorTimer.current) clearTimeout(actorTimer.current);
    if (!q.trim()) { setActorResults([]); setShowActorDropdown(false); return; }
    actorTimer.current = setTimeout(async () => {
      setActorLoading(true);
      const results = await searchPersons(q);
      setActorResults(results.filter(p => p.known_for_department === 'Acting'));
      setShowActorDropdown(true);
      setActorLoading(false);
    }, 400);
  }

  function addActor(person: PersonResult) {
    if (filters.actorIds?.includes(person.id)) return;
    onChange({
      ...filters,
      actorIds: [...(filters.actorIds || []), person.id],
      actorNames: [...(filters.actorNames || []), person.name],
    });
    setActorQuery('');
    setActorResults([]);
    setShowActorDropdown(false);
  }

  function removeActor(id: number) {
    const idx = (filters.actorIds || []).indexOf(id);
    onChange({
      ...filters,
      actorIds: (filters.actorIds || []).filter(a => a !== id),
      actorNames: (filters.actorNames || []).filter((_, i) => i !== idx),
    });
  }

  function toggleGenre(id: number) {
    const current = filters.genreIds || [];
    onChange({
      ...filters,
      genreIds: current.includes(id) ? current.filter(g => g !== id) : [...current, id],
    });
  }

  const activeFiltersCount = [
    filters.year,
    filters.decade,
    (filters.genreIds?.length || 0) > 0,
    filters.watchedStatus !== 'all',
    (filters.actorIds?.length || 0) > 0,
    filters.directorName,
    filters.minImdbRating,
    (filters.withProviders?.length || 0) > 0,
    filters.withAwards,
  ].filter(Boolean).length;

  function resetAll() {
    setDirectorQuery('');
    setActorQuery('');
    onChange({ watchedStatus: 'all', mediaType: filters.mediaType, withProviders: [], withAwards: false });
  }

  return (
    <div className="bg-film-surface border border-film-border rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard size={16} className="text-film-accent" />
          <span className="font-body font-medium text-film-text text-sm tracking-wide uppercase">Filtri</span>
          {activeFiltersCount > 0 && (
            <span className="bg-film-accent text-film-black text-xs font-bold px-2 py-0.5 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <button onClick={resetAll} className="text-film-muted hover:text-film-accent text-xs flex items-center gap-1 transition-colors">
            <X size={12} /> Reset
          </button>
        )}
      </div>

      {/* Già visto */}
      <FilterSection icon={<Film size={14} />} label="Già visto">
        <div className="flex gap-2">
          {(['all', 'unwatched', 'watched'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => onChange({ ...filters, watchedStatus: opt })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filters.watchedStatus === opt
                  ? 'bg-film-accent text-film-black'
                  : 'bg-film-card text-film-muted hover:text-film-text border border-film-border'
              )}
            >
              {opt === 'all' ? 'Tutti' : opt === 'unwatched' ? 'Non visti' : 'Già visti'}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Anno / Decade */}
      <FilterSection icon={<Calendar size={14} />} label="Periodo">
        <div className="space-y-3">
          {/* Decade */}
          <div className="relative">
            <label className="text-film-subtle text-xs mb-1 block">Decade</label>
            <div className="relative">
              <select
                value={filters.decade || ''}
                onChange={e => onChange({ ...filters, decade: e.target.value || undefined, year: undefined })}
                className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text appearance-none cursor-pointer focus:outline-none focus:border-film-accent transition-colors"
              >
                <option value="">Qualsiasi decade</option>
                {DECADES.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-film-muted pointer-events-none" />
            </div>
          </div>
          {/* Anno specifico */}
          <div>
            <label className="text-film-subtle text-xs mb-1 block">Anno specifico</label>
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              placeholder="es. 1994"
              value={filters.year || ''}
              onChange={e => {
                const val = e.target.value ? parseInt(e.target.value) : undefined;
                onChange({ ...filters, year: val, decade: val ? undefined : filters.decade });
              }}
              className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text placeholder:text-film-subtle focus:outline-none focus:border-film-accent transition-colors"
            />
          </div>
        </div>
      </FilterSection>

      {/* Generi */}
      <FilterSection icon={<Film size={14} />} label="Genere">
        <div className="flex flex-wrap gap-2">
          {(filters.mediaType === 'tv' ? TMDB_TV_GENRES : TMDB_MOVIE_GENRES).map(genre => {
            const active = (filters.genreIds || []).includes(genre.id);
            return (
              <button
                key={genre.id}
                onClick={() => toggleGenre(genre.id)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all border',
                  active
                    ? 'bg-film-accent text-film-black border-film-accent'
                    : 'bg-film-card text-film-muted hover:text-film-text border-film-border'
                )}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Voto IMDB */}
      <FilterSection icon={<Star size={14} />} label="Voto minimo">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-film-muted">
            <span>Qualsiasi</span>
            <span className={cn('font-mono font-bold text-base', filters.minImdbRating ? 'text-film-accent' : 'text-film-subtle')}>
              {filters.minImdbRating ? `≥ ${filters.minImdbRating.toFixed(1)}` : '—'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={9}
            step={0.5}
            value={filters.minImdbRating || 0}
            onChange={e => {
              const val = parseFloat(e.target.value);
              onChange({ ...filters, minImdbRating: val > 0 ? val : undefined });
            }}
            className="w-full accent-film-accent cursor-pointer"
          />
          <div className="flex justify-between text-xs text-film-subtle">
            <span>0</span>
            <span>3</span>
            <span>6</span>
            <span>9</span>
          </div>
        </div>
      </FilterSection>

      {/* Attori — solo per film */}
      {filters.mediaType !== 'tv' ? <FilterSection icon={<User size={14} />} label="Attori">
        <div ref={actorRef} className="relative">
          <div className="flex items-center gap-2 bg-film-card border border-film-border rounded-lg px-3 py-2 focus-within:border-film-accent transition-colors">
            <Search size={13} className="text-film-muted shrink-0" />
            <input
              type="text"
              placeholder="Cerca attore..."
              value={actorQuery}
              onChange={e => handleActorSearch(e.target.value)}
              className="bg-transparent text-sm text-film-text placeholder:text-film-subtle focus:outline-none w-full"
            />
            {actorLoading && <div className="w-3 h-3 border border-film-accent border-t-transparent rounded-full animate-spin" />}
          </div>
          {showActorDropdown && actorResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-film-card border border-film-border rounded-xl overflow-hidden z-20 shadow-xl">
              {actorResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => addActor(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-film-surface text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-film-border overflow-hidden shrink-0">
                    {p.profile_path ? (
                      <img src={`https://image.tmdb.org/t/p/w92${p.profile_path}`} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-film-subtle text-xs">{p.name[0]}</div>
                    )}
                  </div>
                  <span className="text-sm text-film-text">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Attori selezionati */}
        {(filters.actorNames || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {(filters.actorNames || []).map((name, i) => (
              <span key={filters.actorIds![i]} className="flex items-center gap-1.5 bg-film-accent/10 text-film-accent border border-film-accent/30 px-2.5 py-1 rounded-lg text-xs">
                {name}
                <button onClick={() => removeActor(filters.actorIds![i])} className="hover:text-film-red transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </FilterSection> : null}

      {/* Regista — solo per film */}
      {filters.mediaType !== 'tv' ? <FilterSection icon={<User size={14} />} label="Regista">
        <input
          type="text"
          placeholder="es. Christopher Nolan"
          value={directorQuery}
          onChange={e => {
            setDirectorQuery(e.target.value);
            onChange({ ...filters, directorName: e.target.value || undefined });
          }}
          className="w-full bg-film-card border border-film-border rounded-lg px-3 py-2 text-sm text-film-text placeholder:text-film-subtle focus:outline-none focus:border-film-accent transition-colors"
        />
      </FilterSection> : null}

      {/* Piattaforme */}
      <FilterSection icon={<Film size={14} />} label="Piattaforma">
        <div className="flex flex-wrap gap-2">
          {getPopularProviders().map(p => {
            const active = (filters.withProviders ?? []).includes(p.provider_id);
            return (
              <button
                key={p.provider_id}
                onClick={() => {
                  const current = filters.withProviders ?? [];
                  onChange({
                    ...filters,
                    withProviders: active
                      ? current.filter(id => id !== p.provider_id)
                      : [...current, p.provider_id],
                  });
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all',
                  active ? 'bg-film-accent text-film-black border-film-accent' : 'bg-film-card text-film-muted border-film-border'
                )}
              >
                <img
                  src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                  alt={p.provider_name}
                  className="w-4 h-4 rounded-sm"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {p.provider_name}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Oscar */}
      <FilterSection icon={<Star size={14} />} label="Premi">
        <button
          onClick={() => onChange({ ...filters, withAwards: !filters.withAwards })}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all w-full',
            filters.withAwards
              ? 'bg-film-accent text-film-black border-film-accent'
              : 'bg-film-card text-film-muted border-film-border'
          )}
        >
          🏆 Candidature / vittorie Oscar
        </button>
      </FilterSection>

    </div>
  );
}

function FilterSection({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-film-muted">
        <span className="text-film-accent">{icon}</span>
        <span className="text-xs uppercase tracking-widest font-medium">{label}</span>
      </div>
      {children}
    </div>
  );
}
