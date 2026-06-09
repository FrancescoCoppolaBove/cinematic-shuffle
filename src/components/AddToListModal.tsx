/**
 * AddToListModal — bottom sheet per aggiungere/rimuovere un film dalle liste
 * tematiche dell'utente. Mostra le liste esistenti con stato di appartenenza
 * e consente di crearne una nuova al volo.
 */
import { useState } from 'react';
import { X, Plus, Check, ListPlus } from 'lucide-react';
import type { MovieList, TMDBMovieDetail } from '../types';
import { getTitle } from '../services/tmdb';
import { cn } from '../utils';

interface AddToListModalProps {
  movie: TMDBMovieDetail;
  lists: MovieList[];
  onClose: () => void;
  onCreateList: (name: string) => Promise<MovieList | null>;
  onAddToList: (listId: string, movie: TMDBMovieDetail) => Promise<void>;
  onRemoveFromList: (listId: string, movieId: number) => Promise<void>;
}

export function AddToListModal({
  movie, lists, onClose, onCreateList, onAddToList, onRemoveFromList,
}: AddToListModalProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function toggle(list: MovieList) {
    if (busy) return;
    setBusy(true);
    try {
      if (list.items.some(i => i.id === movie.id)) {
        await onRemoveFromList(list.id, movie.id);
      } else {
        await onAddToList(list.id, movie);
      }
    } finally { setBusy(false); }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await onCreateList(name);
      if (created) await onAddToList(created.id, movie);
      setNewName('');
      setCreating(false);
    } finally { setBusy(false); }
  }

  return (
    <div
      className="fixed inset-0 z-[115] flex flex-col bg-film-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex-1" />
      <div
        className="bg-film-black border-t border-film-border rounded-t-3xl max-h-[75vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-film-border shrink-0">
          <div className="min-w-0">
            <h3 className="text-film-text font-semibold">Aggiungi a lista</h3>
            <p className="text-film-subtle text-xs truncate">{getTitle(movie)}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full active:bg-film-surface">
            <X size={18} className="text-film-subtle" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Create new */}
          {creating ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="Nome della lista…"
                maxLength={60}
                className="flex-1 bg-film-card border border-film-border rounded-xl px-3 py-2.5 text-film-text placeholder:text-film-subtle focus:outline-none focus:border-film-accent"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || busy}
                className="shrink-0 px-4 rounded-xl bg-film-accent text-film-black font-semibold text-sm active:scale-95 disabled:opacity-50"
              >
                Crea
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-film-border text-film-accent active:bg-film-surface"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">Nuova lista</span>
            </button>
          )}

          {/* Existing lists */}
          {lists.length === 0 && !creating && (
            <div className="flex flex-col items-center text-center py-8 text-film-muted">
              <ListPlus size={28} className="mb-2 opacity-50" />
              <p className="text-sm">Nessuna lista ancora.<br />Creane una per organizzare i tuoi film.</p>
            </div>
          )}

          {lists.map(list => {
            const inList = list.items.some(i => i.id === movie.id);
            return (
              <button
                key={list.id}
                onClick={() => toggle(list)}
                disabled={busy}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-film-surface border border-film-border active:opacity-70 disabled:opacity-60"
              >
                <div className={cn(
                  'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                  inList ? 'bg-film-accent border-film-accent' : 'border-film-border'
                )}>
                  {inList && <Check size={14} className="text-film-black" strokeWidth={3} />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-film-text text-sm font-medium truncate">{list.name}</p>
                  <p className="text-film-subtle text-xs">{list.items.length} titoli</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
