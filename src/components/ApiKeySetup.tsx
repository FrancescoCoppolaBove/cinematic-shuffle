import { useState } from 'react';
import { Key, ExternalLink, ChevronRight } from 'lucide-react';

interface ApiKeySetupProps {
  onSave: (key: string) => void;
}

export function ApiKeySetup({ onSave }: ApiKeySetupProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  async function handleSubmit() {
    if (!key.trim()) { setError('Inserisci la tua API key'); return; }
    setTesting(true);
    setError('');
    try {
      const res = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${key.trim()}`);
      if (!res.ok) throw new Error('Key non valida');
      // Salva in localStorage per persistenza durante la sessione
      localStorage.setItem('tmdb_runtime_key', key.trim());
      onSave(key.trim());
    } catch {
      setError('API key non valida. Verificala su themoviedb.org');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-film-black flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="text-6xl mb-4">🎬</div>
          <h1 className="font-display text-4xl text-film-text tracking-widest">CINEMATIC</h1>
          <h2 className="font-display text-4xl text-film-accent tracking-widest">SHUFFLE</h2>
        </div>

        {/* Card */}
        <div className="bg-film-surface border border-film-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-film-accent/10 border border-film-accent/30 flex items-center justify-center">
              <Key size={16} className="text-film-accent" />
            </div>
            <div>
              <p className="text-film-text font-medium text-sm">Configura la tua API key</p>
              <p className="text-film-muted text-xs">Necessaria per accedere al database dei film</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-film-muted text-xs leading-relaxed">
              Cinematic Shuffle usa le API di <strong className="text-film-text">The Movie Database (TMDB)</strong>, 
              gratuite per uso personale. Ottieni la tua key in pochi secondi:
            </p>
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-film-accent text-xs hover:text-film-accent-dim transition-colors"
            >
              <ExternalLink size={12} />
              themoviedb.org/settings/api
              <ChevronRight size={12} />
            </a>
          </div>

          <div className="space-y-2">
            <label className="text-film-subtle text-xs uppercase tracking-wider">La tua API Key</label>
            <input
              type="text"
              placeholder="es. a1b2c3d4e5f6..."
              value={key}
              onChange={e => { setKey(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-film-card border border-film-border rounded-xl px-4 py-3 text-sm text-film-text placeholder:text-film-subtle focus:outline-none focus:border-film-accent transition-colors font-mono"
            />
            {error && <p className="text-film-red text-xs">{error}</p>}
          </div>

          <button
            onClick={handleSubmit}
            disabled={testing || !key.trim()}
            className="w-full py-3 bg-film-accent hover:bg-film-accent-dim text-film-black font-display text-lg tracking-widest rounded-xl transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'VERIFICA...' : 'INIZIA'}
          </button>

          <p className="text-film-subtle text-xs text-center">
            La key viene salvata solo nel tuo browser, mai inviata a server esterni.
          </p>
        </div>
      </div>
    </div>
  );
}
