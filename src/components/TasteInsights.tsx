/**
 * TasteInsights — il "cinephile portrait" dell'utente, stile Wrapped.
 * Generi top, decade/lingua preferite, ore guardate, classifiche di registi e
 * attori più visti (crediti recuperati da TMDB con cache) e un'etichetta di gusto.
 */
import { useMemo } from 'react';
import {
  Clapperboard, Globe, CalendarRange, Clock, TrendingUp, Megaphone, Users, Sparkles,
} from 'lucide-react';
import type { WatchedMovie } from '../types';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES, COMMON_LANGUAGES } from '../types';
import { getImageUrl, getPersonName } from '../services/tmdb';
import { useWatchedCredits, type RankedPerson } from '../hooks/useWatchedCredits';
import { cinephileName } from '../utils/cinephileName';
import { cn } from '../utils';

const GENRE_NAME = new Map<number, string>(
  [...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES].map(g => [g.id, g.name])
);
const LANG_NAME = new Map<string, string>(
  COMMON_LANGUAGES.map(l => [l.code, l.name.replace(/\s*\(.*\)/, '')])
);

function decadeLabel(decade: string): string {
  const start = parseInt(decade);
  if (Number.isNaN(start)) return decade;
  return `${start}s`;
}

export function TasteInsights({ watchedMovies, onOpenPerson }: {
  watchedMovies: WatchedMovie[];
  onOpenPerson?: (id: number, name: string) => void;
}) {
  const { topDirectors, topActors, loading: creditsLoading, progress } = useWatchedCredits(watchedMovies);
  const pct = Math.round(progress * 100);

  const stats = useMemo(() => {
    if (watchedMovies.length === 0) return null;

    const liked = watchedMovies.filter(
      m => m.liked || (m.personal_rating !== null && m.personal_rating >= 3.5)
    );
    const taste = liked.length >= 3 ? liked : watchedMovies;

    // Generi (conteggio su tutti i film, per avere abbastanza dati per 10)
    const genreCount = new Map<number, number>();
    for (const m of taste) {
      for (const g of m.genre_ids ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
    const topGenres = [...genreCount.entries()]
      .filter(([id]) => GENRE_NAME.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, n]) => ({ id, name: GENRE_NAME.get(id)!, count: n }));
    const maxGenre = topGenres[0]?.count ?? 1;

    // Decade
    const decadeCount = new Map<string, number>();
    for (const m of taste) {
      const year = parseInt(m.release_date?.slice(0, 4) ?? '0');
      if (year < 1920) continue;
      const d = `${Math.floor(year / 10) * 10}s`;
      decadeCount.set(d, (decadeCount.get(d) ?? 0) + 1);
    }
    const topDecade = [...decadeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    // Lingua
    const langCount = new Map<string, number>();
    for (const m of taste) {
      if (m.original_language) langCount.set(m.original_language, (langCount.get(m.original_language) ?? 0) + 1);
    }
    const topLangEntry = [...langCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const topLangCode = topLangEntry?.[0];
    const topLang = topLangEntry ? (LANG_NAME.get(topLangEntry[0]) ?? topLangEntry[0].toUpperCase()) : null;

    // Ore guardate
    const totalMinutes = watchedMovies.reduce((s, m) => s + (m.runtime ?? 0), 0);
    const totalHours = Math.round(totalMinutes / 60);

    // Attività anno corrente
    const thisYear = new Date().getFullYear();
    const thisYearCount = watchedMovies.filter(m => {
      const t = Date.parse(m.addedAt);
      return !Number.isNaN(t) && new Date(t).getFullYear() === thisYear;
    }).length;

    const cine = cinephileName({
      topGenreIds: topGenres.map(g => g.id),
      topDecade,
      topLangCode,
      watchedCount: watchedMovies.length,
    });

    return { topGenres, maxGenre, topDecade, topLang, topLangCode, totalHours, thisYear, thisYearCount, cine };
  }, [watchedMovies]);

  if (!stats || stats.topGenres.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        <TrendingUp size={15} className="text-film-accent" />
        <h2 className="flex-1 text-film-text text-sm font-semibold tracking-wide">Your cinephile portrait</h2>
      </div>

      {/* Nome da cinefilo */}
      {stats.cine && (
        <div className="bg-gradient-to-r from-film-accent/20 to-transparent border border-film-accent/30 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Sparkles size={18} className="text-film-accent shrink-0" />
          <div className="min-w-0">
            <p className="text-film-subtle text-[10px] uppercase tracking-widest">{stats.cine.subtitle}</p>
            <p className="text-film-text font-display text-lg tracking-wide leading-tight">{stats.cine.name}</p>
          </div>
        </div>
      )}

      {/* Generi preferiti (fino a 10) */}
      <div className="bg-film-surface border border-film-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clapperboard size={14} className="text-film-accent" />
          <span className="text-film-subtle text-xs uppercase tracking-widest">Top genres</span>
        </div>
        <div className="space-y-2.5">
          {stats.topGenres.map((g, i) => (
            <div key={g.id}>
              <div className="flex justify-between text-xs mb-1">
                <span className={cn('font-medium', i === 0 ? 'text-film-accent' : 'text-film-text')}>
                  <span className="text-film-subtle mr-1.5">{i + 1}</span>{g.name}
                </span>
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

      {/* Tessere: decade, lingua, ore */}
      <div className="grid grid-cols-3 gap-2">
        <InsightTile icon={<CalendarRange size={14} />} label="Decade" value={stats.topDecade ? decadeLabel(stats.topDecade) : '—'} />
        <InsightTile icon={<Globe size={14} />} label="Cinema" value={stats.topLang ?? '—'} />
        <InsightTile icon={<Clock size={14} />} label="Hours" value={stats.totalHours > 0 ? `${stats.totalHours}h` : '—'} />
      </div>

      {/* Registi più visti (top 5) — niente "contatore": skeleton finché pronto */}
      <PeopleRanking
        icon={<Megaphone size={14} />}
        title="Most-watched directors"
        people={topDirectors.slice(0, 5)}
        loading={creditsLoading && topDirectors.length === 0}
        pct={pct}
        onOpenPerson={onOpenPerson}
      />

      {/* Attori più visti (top 10) — avatar scorrevoli */}
      <div className="bg-film-surface border border-film-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-film-accent" />
          <span className="text-film-subtle text-xs uppercase tracking-widest">Most-watched actors</span>
        </div>
        {topActors.length === 0 ? (
          creditsLoading ? (
            <>
              <div className="flex gap-3 -mx-1 px-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 w-16 shrink-0">
                    <div className="w-16 h-16 rounded-full bg-film-card animate-pulse" />
                    <div className="w-12 h-2 rounded bg-film-card animate-pulse" />
                  </div>
                ))}
              </div>
              <LoadingHint pct={pct} />
            </>
          ) : (
            <p className="text-film-subtle text-xs">No data</p>
          )
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {topActors.slice(0, 10).map((p, i) => (
              <ActorAvatar key={p.id} person={p} rank={i + 1} onOpenPerson={onOpenPerson} />
            ))}
          </div>
        )}
      </div>

      {/* Attività dell'anno */}
      {stats.thisYearCount > 0 && (
        <div className="bg-gradient-to-r from-film-accent/15 to-transparent border border-film-accent/25 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="font-display text-2xl text-film-accent font-bold">{stats.thisYearCount}</span>
          <span className="text-film-text text-sm leading-tight">
            titles logged in <span className="font-semibold">{stats.thisYear}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function LoadingHint({ pct }: { pct: number }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-film-card overflow-hidden">
        <div className="h-full rounded-full bg-film-accent/70 transition-all duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <span className="text-film-subtle text-[10px] tabular-nums">Analyzing your library… {pct}%</span>
    </div>
  );
}

function PeopleRanking({ icon, title, people, loading, pct, onOpenPerson }: {
  icon: React.ReactNode; title: string; people: RankedPerson[]; loading: boolean; pct: number;
  onOpenPerson?: (id: number, name: string) => void;
}) {
  return (
    <div className="bg-film-surface border border-film-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-film-accent">{icon}</span>
        <span className="text-film-subtle text-xs uppercase tracking-widest">{title}</span>
      </div>
      {people.length === 0 ? (
        loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-4" />
                <div className="w-9 h-9 rounded-full bg-film-card animate-pulse shrink-0" />
                <div className="flex-1 h-3 rounded bg-film-card animate-pulse" style={{ maxWidth: `${70 - i * 8}%` }} />
              </div>
            ))}
            <LoadingHint pct={pct} />
          </div>
        ) : (
          <p className="text-film-subtle text-xs">No data</p>
        )
      ) : (
        <div className="space-y-2.5">
          {people.map((p, i) => {
            const photo = getImageUrl(p.profile_path, 'w185');
            return (
              <button
                key={p.id}
                onClick={() => onOpenPerson?.(p.id, p.name)}
                disabled={!onOpenPerson}
                className="w-full flex items-center gap-3 text-left active:opacity-60 disabled:active:opacity-100"
              >
                <span className={cn('font-display text-sm w-4 text-center shrink-0', i === 0 ? 'text-film-accent' : 'text-film-subtle')}>{i + 1}</span>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-film-card border border-film-border shrink-0">
                  {photo
                    ? <img src={photo} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-film-subtle text-xs">{p.name[0]}</div>}
                </div>
                <span className="flex-1 text-film-text text-sm truncate">{getPersonName(p.name)}</span>
                <span className="text-film-subtle text-xs shrink-0">{p.count} {p.count === 1 ? 'title' : 'titles'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActorAvatar({ person, rank, onOpenPerson }: {
  person: RankedPerson; rank: number;
  onOpenPerson?: (id: number, name: string) => void;
}) {
  const photo = getImageUrl(person.profile_path, 'w185');
  return (
    <button
      onClick={() => onOpenPerson?.(person.id, person.name)}
      disabled={!onOpenPerson}
      className="flex flex-col items-center gap-1.5 w-16 shrink-0 active:opacity-60 disabled:active:opacity-100"
    >
      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-film-card border border-film-border">
        {photo
          ? <img src={photo} alt={person.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-film-subtle text-lg">{person.name[0]}</div>}
        <span className="absolute -top-0.5 -left-0.5 w-5 h-5 rounded-full bg-film-accent text-film-black text-[10px] font-bold flex items-center justify-center border-2 border-film-surface">
          {rank}
        </span>
      </div>
      <span className="text-film-text text-[11px] text-center leading-tight line-clamp-2">{getPersonName(person.name)}</span>
      <span className="text-film-subtle text-[10px]">{person.count} {person.count === 1 ? 'title' : 'titles'}</span>
    </button>
  );
}

function InsightTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-film-surface border border-film-border rounded-2xl px-2 py-3 flex flex-col items-center gap-1 text-center">
      <span className="text-film-accent">{icon}</span>
      <span className="font-display text-sm font-bold text-film-text leading-tight break-words">{value}</span>
      <span className="text-film-subtle text-[10px] uppercase tracking-wider">{label}</span>
    </div>
  );
}
