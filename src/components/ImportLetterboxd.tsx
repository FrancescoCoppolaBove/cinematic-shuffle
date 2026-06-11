/**
 * ImportLetterboxd — importa i film visti da un export Letterboxd (CSV).
 * Funziona con watched.csv / ratings.csv / diary.csv: cerca le colonne
 * Name, Year e (se presente) Rating. Ogni film viene risolto su TMDB
 * (titolo+anno), ne vengono scaricati i dettagli e poi importato tra i visti.
 */
import { useState } from 'react';
import { X, Upload, CheckCircle, FileText } from 'lucide-react';
import type { TMDBMovieDetail } from '../types';
import { searchMovieByTitleYear, getMovieDetail } from '../services/tmdb';

interface Props {
  onImport: (items: { movie: TMDBMovieDetail; rating: number | null; watchedDate?: string }[]) => Promise<void>;
  onClose: () => void;
}

interface Row { name: string; year: number; rating: number | null; date?: string }

// Parser CSV minimale che gestisce i campi tra virgolette.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function ImportLetterboxd({ onImport, onClose }: Props) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; notFound: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) { setError('File vuoto o non valido.'); return; }

      const header = rows[0].map(h => h.trim().toLowerCase());
      const iName = header.indexOf('name');
      const iYear = header.indexOf('year');
      const iRating = header.indexOf('rating');
      const iDate = header.indexOf('watched date') !== -1 ? header.indexOf('watched date') : header.indexOf('date');
      if (iName === -1 || iYear === -1) {
        setError("Colonne 'Name' e 'Year' non trovate. Usa l'export CSV di Letterboxd.");
        return;
      }

      // Deduplica per nome+anno, tenendo l'eventuale voto.
      const map = new Map<string, Row>();
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        const name = (cells[iName] ?? '').trim();
        const year = parseInt((cells[iYear] ?? '').trim());
        if (!name || Number.isNaN(year)) continue;
        const rating = iRating !== -1 ? parseFloat((cells[iRating] ?? '').trim()) : NaN;
        const rawDate = iDate !== -1 ? (cells[iDate] ?? '').trim() : '';
        const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
        map.set(`${name}|${year}`, { name, year, rating: Number.isNaN(rating) ? null : rating, date });
      }
      const list = [...map.values()];
      if (list.length === 0) { setError('No valid films in the file.'); return; }

      setPhase('working');
      setProgress(0);
      const items: { movie: TMDBMovieDetail; rating: number | null; watchedDate?: string }[] = [];
      const notFound: string[] = [];
      const CHUNK = 6;
      for (let i = 0; i < list.length; i += CHUNK) {
        const batch = list.slice(i, i + CHUNK);
        await Promise.all(batch.map(async row => {
          const found = await searchMovieByTitleYear(row.name, row.year);
          if (!found) { notFound.push(`${row.name} (${row.year})`); return; }
          try {
            const movie = await getMovieDetail(found.id, 'movie');
            items.push({ movie, rating: row.rating, watchedDate: row.date });
          } catch { notFound.push(`${row.name} (${row.year})`); }
        }));
        setProgress(Math.min(1, (i + batch.length) / list.length));
      }

      await onImport(items);
      setResult({ imported: items.length, notFound });
      setPhase('done');
    } catch {
      setError('Could not read the file.');
      setPhase('idle');
    }
  }

  return (
    <div className="fixed inset-0 z-[115] flex flex-col bg-film-black/60 backdrop-blur-sm" onClick={phase === 'working' ? undefined : onClose}>
      <div className="flex-1" />
      <div
        className="bg-film-black border-t border-film-border rounded-t-3xl max-h-[80vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-film-border">
          <h3 className="text-film-text font-semibold">Import from Letterboxd</h3>
          {phase !== 'working' && (
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full active:bg-film-surface">
              <X size={18} className="text-film-subtle" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {phase === 'idle' && (
            <>
              <div className="text-film-muted text-sm space-y-2 leading-relaxed">
                <p>On Letterboxd: <span className="text-film-text">Settings → Import &amp; Export → Export your data</span>.</p>
                <p>Upload the <span className="text-film-text font-mono text-xs">ratings.csv</span> (or <span className="font-mono text-xs">watched.csv</span>) file from the downloaded zip here.</p>
              </div>
              <label className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-dashed border-film-border bg-film-surface active:opacity-70 cursor-pointer">
                <Upload size={26} className="text-film-accent" />
                <span className="text-film-text text-sm font-medium">Choose CSV file</span>
                <span className="text-film-subtle text-xs">ratings (0.5–5) are imported as yours</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              </label>
              {error && <p className="text-film-red text-xs">{error}</p>}
            </>
          )}

          {phase === 'working' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 border-2 border-film-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-film-text text-sm">Importazione in corso… {Math.round(progress * 100)}%</p>
              <div className="w-full h-1.5 rounded-full bg-film-surface overflow-hidden">
                <div className="h-full bg-film-accent rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="text-film-subtle text-xs text-center">Don't close the app during import</p>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={20} />
                <p className="text-film-text font-medium">{result.imported} titles imported 🎉</p>
              </div>
              {result.notFound.length > 0 && (
                <div className="bg-film-surface border border-film-border rounded-xl p-3">
                  <p className="text-film-subtle text-xs mb-1 flex items-center gap-1.5">
                    <FileText size={12} />{result.notFound.length} non trovati su TMDB
                  </p>
                  <p className="text-film-subtle text-[11px] leading-relaxed line-clamp-4">
                    {result.notFound.slice(0, 30).join(' · ')}
                  </p>
                </div>
              )}
              <button onClick={onClose} className="w-full py-3 rounded-2xl bg-film-accent text-film-black font-semibold active:scale-[0.98]">
                Fatto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
