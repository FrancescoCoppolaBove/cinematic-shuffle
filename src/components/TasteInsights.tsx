/**
 * TasteInsights — il "ritratto cinefilo" dell'utente, stile Wrapped.
 * Tutto calcolato in locale dai film già segnati come visti: generi top,
 * decade e cinematografia preferite, ore guardate, attività dell'anno.
 * Read-only: nessuna chiamata di rete.
 */
import { useMemo } from 'react';
import { Clapperboard, Globe, CalendarRange, Clock, TrendingUp } from 'lucide-react';
import type { WatchedMovie } from '../types';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES, COMMON_LANGUAGES } from '../types';
import { cn } from '../utils';

const GENRE_NAME = new Map<number, string>(
  [...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES].map(g => [g.id, g.name])
);

const LANG_NAME = new Map<string, string>(
  COMMON_LANGUAGES.map(l => [l.code, l.name.replace(/\s*\(.*\)/, '')])
);

function decadeLabel(decade: string): string {
  // "1990s" → "Anni '90", "2000s" → "Anni 2000"
  const start = parseInt(decade);
  if (Number.isNaN(start)) return decade;
  return start >= 2000 ? `Anni ${start}` : `Anni '${String(start).slice(2)}`;
}

export function TasteInsights({ watchedMovies }: { watchedMovies: WatchedMovie[] }) {
  const stats = useMemo(() => {
    if (watchedMovies.length === 0) return null;

    // Solo i film apprezzati definiscono il "gusto"; se non ce ne sono ancora,
    // ripieghiamo su tutti i visti per non lasciare la card vuota.
    const liked = watchedMovies.filter(
      m => m.liked || (m.personal_rating !== null && m.personal_rating >= 3.5)
    );
    const taste = liked.length >= 3 ? liked : watchedMovies;

    // Top generi
    const genreCount = new Map<number, number>();
    for (const m of taste) {
      for (const g of m.genre_ids ?? []) {
        genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
      }
    }
    const topGenres = [...genreCount.entries()]
      .filter(([id]) => GENRE_NAME.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, n]) => ({ name: GENRE_NAME.get(id)!, count: n }));
    const maxGenre = topGenres[0]?.count ?? 1;

    // Decade preferita
    const decadeCount = new Map<string, number>();
    for (const m of taste) {
      const year = parseInt(m.release_date?.slice(0, 4) ?? '0');
      if (year < 1920) continue;
      const d = `${Math.floor(year / 10) * 10}s`;
      decadeCount.set(d, (decadeCount.get(d) ?? 0) + 1);
    }
    const topDecade = [...decadeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    // Cinematografia (lingua) preferita
    const langCount = new Map<string, number>();
    for (const m of taste) {
      if (!m.original_language) continue;
      langCount.set(m.original_language, (langCount.get(m.original_language) ?? 0) + 1);
    }
    const topLangEntry = [...langCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const topLang = topLangEntry
      ? (LANG_NAME.get(topLangEntry[0]) ?? topLangEntry[0].toUpperCase())
      : null;

    // Ore guardate (solo film con runtime nota)
    const totalMinutes = watchedMovies.reduce((s, m) => s + (m.runtime ?? 0), 0);
    const totalHours = Math.round(totalMinutes / 60);

    // Attività dell'anno corrente (per data di aggiunta)
    const thisYear = new Date().getFullYear();
    const thisYearCount = watchedMovies.filter(m => {
      const t = Date.parse(m.addedAt);
      return !Number.isNaN(t) && new Date(t).getFullYear() === thisYear;
    }).length;

    return { topGenres, maxGenre, topDecade, topLang, totalHours, thisYear, thisYearCount };
  }, [watchedMovies]);

  if (!stats || stats.topGenres.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        <TrendingUp size={15} className="text-film-accent" />
        <h2 className="text-film-text text-sm font-semibold tracking-wide">Il tuo ritratto cinefilo</h2>
      </div>

      {/* Generi preferiti con barre */}
      <div className="bg-film-surface border border-film-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clapperboard size={14} className="text-film-accent" />
          <span className="text-film-subtle text-xs uppercase tracking-widest">Generi preferiti</span>
        </div>
        <div className="space-y-2.5">
          {stats.topGenres.map((g, i) => (
            <div key={g.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className={cn('font-medium', i === 0 ? 'text-film-accent' : 'text-film-text')}>{g.name}</span>
                <span className="text-film-subtle">{g.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-film-card overflow-hidden">
                <div
                  className={cn('h-full rounded-full', i === 0 ? 'bg-film-accent' : 'bg-film-accent/50')}
                  style={{ width: `${Math.round((g.count / stats.maxGenre) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tre tessere: decade, lingua, ore */}
      <div className="grid grid-cols-3 gap-2">
        <InsightTile
          icon={<CalendarRange size={14} />}
          label="Decade"
          value={stats.topDecade ? decadeLabel(stats.topDecade) : '—'}
        />
        <InsightTile
          icon={<Globe size={14} />}
          label="Cinema"
          value={stats.topLang ?? '—'}
        />
        <InsightTile
          icon={<Clock size={14} />}
          label="Ore viste"
          value={stats.totalHours > 0 ? `${stats.totalHours}h` : '—'}
        />
      </div>

      {/* Riga attività dell'anno */}
      {stats.thisYearCount > 0 && (
        <div className="bg-gradient-to-r from-film-accent/15 to-transparent border border-film-accent/25 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="font-display text-2xl text-film-accent font-bold">{stats.thisYearCount}</span>
          <span className="text-film-text text-sm leading-tight">
            titoli segnati nel <span className="font-semibold">{stats.thisYear}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function InsightTile({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string;
}) {
  return (
    <div className="bg-film-surface border border-film-border rounded-2xl px-2 py-3 flex flex-col items-center gap-1 text-center">
      <span className="text-film-accent">{icon}</span>
      <span className="font-display text-sm font-bold text-film-text leading-tight break-words">{value}</span>
      <span className="text-film-subtle text-[10px] uppercase tracking-wider">{label}</span>
    </div>
  );
}
