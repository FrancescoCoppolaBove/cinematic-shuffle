/**
 * MovieDetailTabs — tab Cast / Crew / Generi nella scheda film.
 * Ispirata a Letterboxd ma con il nostro stile.
 */
import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { TMDBKeyword } from '../services/tmdb';
import type { TMDBMovieDetail } from '../types';
import { getMovieKeywords, getImageUrl } from '../services/tmdb';
import { cn } from '../utils';

interface MovieDetailTabsProps {
  movie: TMDBMovieDetail;
  onOpenPerson: (id: number, name: string) => void;
  onOpenGenre: (genreId: number, genreName: string, mediaType: 'movie' | 'tv') => void;
  onOpenKeyword: (keywordId: number, keywordName: string, mediaType: 'movie' | 'tv') => void;
}

type Tab = 'cast' | 'crew' | 'generi';

export function MovieDetailTabs({
  movie, onOpenPerson, onOpenGenre, onOpenKeyword,
}: MovieDetailTabsProps) {
  const [tab, setTab] = useState<Tab>('cast');
  const [keywords, setKeywords] = useState<TMDBKeyword[]>([]);
  const [loadingKw, setLoadingKw] = useState(false);

  useEffect(() => {
    if (tab === 'generi' && keywords.length === 0) {
      setLoadingKw(true);
      getMovieKeywords(movie.id, movie.media_type)
        .then(setKeywords)
        .catch(() => {})
        .finally(() => setLoadingKw(false));
    }
  }, [tab, movie.id, movie.media_type, keywords.length]);

  const cast = movie.credits?.cast ?? [];
  const crew = movie.credits?.crew ?? [];

  // Deduplicate crew by person+job, group by department
  type CrewMember = typeof crew[0];
  const crewByDept = crew.reduce<Record<string, CrewMember[]>>((acc: Record<string, CrewMember[]>, m: CrewMember) => {
    const dept = m.department || 'Altro';
    if (!acc[dept]) acc[dept] = [];
    if (!acc[dept].find((x: CrewMember) => x.id === m.id && x.job === m.job)) {
      acc[dept].push(m);
    }
    return acc;
  }, {});

  const DEPT_ORDER = ['Directing', 'Writing', 'Production', 'Camera', 'Art', 'Sound', 'Editing', 'Visual Effects', 'Crew', 'Altro'];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-film-surface rounded-xl p-1 border border-film-border">
        {(['cast', 'crew', 'generi'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-medium transition-all capitalize',
              tab === t
                ? 'bg-film-accent text-film-black'
                : 'text-film-muted'
            )}
          >
            {t === 'cast' ? `Cast (${cast.length})` : t === 'crew' ? 'Crew' : 'Generi'}
          </button>
        ))}
      </div>

      {/* ── Cast ── */}
      {tab === 'cast' && (
        <div className="space-y-1">
          {cast.length === 0 ? (
            <p className="text-film-muted text-sm py-4 text-center">Cast non disponibile</p>
          ) : (
            cast.map((actor: typeof cast[0]) => (
              <PersonRow
                key={`${actor.id}-${actor.character}`}
                name={actor.name}
                subtitle={actor.character}
                profile_path={actor.profile_path}
                isWatched={false}
                onClick={() => onOpenPerson(actor.id, actor.name)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Crew ── */}
      {tab === 'crew' && (
        <div className="space-y-5">
          {Object.keys(crewByDept).length === 0 ? (
            <p className="text-film-muted text-sm py-4 text-center">Crew non disponibile</p>
          ) : (
            DEPT_ORDER
              .filter(d => crewByDept[d])
              .map(dept => (
                <div key={dept}>
                  <h4 className="text-film-subtle text-xs uppercase tracking-widest mb-2">{dept}</h4>
                  <div className="space-y-1">
                    {crewByDept[dept].map((m: CrewMember) => (
                      <PersonRow
                        key={`${m.id}-${m.job}`}
                        name={m.name}
                        subtitle={m.job}
                        profile_path={m.profile_path}
                        isWatched={false}
                        onClick={() => onOpenPerson(m.id, m.name)}
                      />
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ── Generi & Keywords ── */}
      {tab === 'generi' && (
        <div className="space-y-5">
          {/* Generi TMDB */}
          {movie.genres && movie.genres.length > 0 && (
            <div>
              <h4 className="text-film-subtle text-xs uppercase tracking-widest mb-2">Generi</h4>
              <div className="space-y-1">
                {movie.genres.map((g: {id:number;name:string}) => (
                  <button
                    key={g.id}
                    onClick={() => onOpenGenre(g.id, g.name, movie.media_type)}
                    className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl active:bg-film-surface/60 transition-colors"
                  >
                    <span className="text-film-text text-sm">{g.name}</span>
                    <ChevronRight size={14} className="text-film-subtle" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keywords = "Temi" */}
          {loadingKw ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : keywords.length > 0 ? (
            <div>
              <h4 className="text-film-subtle text-xs uppercase tracking-widest mb-2">Temi</h4>
              <div className="flex flex-wrap gap-2">
                {keywords.map(kw => (
                  <button
                    key={kw.id}
                    onClick={() => onOpenKeyword(kw.id, kw.name, movie.media_type)}
                    className="px-3 py-1.5 rounded-xl bg-film-surface border border-film-border text-film-muted text-xs active:border-film-accent active:text-film-accent transition-colors"
                  >
                    {kw.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PersonRow({ name, subtitle, profile_path, onClick }: {
  name: string; subtitle?: string;
  profile_path: string | null; isWatched: boolean; onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const photo = !imgErr ? getImageUrl(profile_path, 'w92') : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 px-2 rounded-xl active:bg-film-surface/60 transition-colors text-left"
    >
      <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-film-surface border border-film-border">
        {photo
          ? <img src={photo} alt={name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center text-film-subtle text-sm font-display">
              {name[0]}
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-film-text text-sm font-medium truncate">{name}</p>
        {subtitle && <p className="text-film-subtle text-xs truncate italic">{subtitle}</p>}
      </div>
      <ChevronRight size={14} className="text-film-subtle shrink-0" />
    </button>
  );
}
