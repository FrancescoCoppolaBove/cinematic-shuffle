import { useState } from 'react';
import { Key, ExternalLink, ChevronRight } from 'lucide-react';
import { APP_NAME, BRAND_LOGO_SRC, BRAND_WORDMARK_SRC } from '../constants/brand';

interface ApiKeySetupProps {
  onSave: (key: string) => void;
}

export function ApiKeySetup({ onSave }: ApiKeySetupProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  async function handleSubmit() {
    if (!key.trim()) { setError('Enter your API key'); return; }
    setTesting(true);
    setError('');
    try {
      const res = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${key.trim()}`);
      if (!res.ok) throw new Error('Invalid key');
      // Salva in localStorage per persistenza durante la sessione
      localStorage.setItem('tmdb_runtime_key', key.trim());
      onSave(key.trim());
    } catch {
      setError('Invalid API key. Check it on themoviedb.org.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-film-black flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center space-y-4">
          <img src={BRAND_LOGO_SRC} alt="" className="mx-auto h-24 w-24 rounded-3xl object-contain" />
          <img src={BRAND_WORDMARK_SRC} alt={APP_NAME} className="mx-auto w-full max-w-[260px] object-contain" />
        </div>

        {/* Card */}
        <div className="bg-film-surface border border-film-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-film-accent/10 border border-film-accent/30 flex items-center justify-center">
              <Key size={16} className="text-film-accent" />
            </div>
            <div>
              <p className="text-film-text font-medium text-sm">Set up your API key</p>
              <p className="text-film-muted text-xs">Required to access the movie database.</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-film-muted text-xs leading-relaxed">
              {APP_NAME} uses <strong className="text-film-text">The Movie Database (TMDB)</strong> APIs,
              free for personal use. Get your key in a few seconds:
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
            <label className="text-film-subtle text-xs uppercase tracking-wider">Your API key</label>
            <input
              type="text"
              placeholder="e.g. a1b2c3d4e5f6..."
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
            {testing ? 'CHECKING...' : 'START'}
          </button>

          <p className="text-film-subtle text-xs text-center">
            The key is saved only in your browser and never sent to external servers.
          </p>
        </div>
      </div>
    </div>
  );
}
