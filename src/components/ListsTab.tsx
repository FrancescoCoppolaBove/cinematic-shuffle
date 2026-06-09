/**
 * ListsTab — gestione delle liste tematiche dell'utente.
 * Vista indice (tutte le liste) + vista dettaglio (i film di una lista).
 */
import { useState } from 'react';
import { Plus, ChevronLeft, Trash2, Pencil, ListPlus, X, Check } from 'lucide-react';
import type { MovieList } from '../types';
import { getImageUrl } from '../services/tmdb';
import { formatYear } from '../utils';

interface ListsTabProps {
  lists: MovieList[];
  onCreateList: (name: string) => Promise<MovieList | null>;
  onRenameList: (listId: string, name: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onRemoveFromList: (listId: string, movieId: number) => Promise<void>;
  onOpenMovie: (id: number, mt: 'movie' | 'tv') => void;
}

export function ListsTab({
  lists, onCreateList, onRenameList, onDeleteList, onRemoveFromList, onOpenMovie,
}: ListsTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const openList = openId ? lists.find(l => l.id === openId) ?? null : null;

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    await onCreateList(name);
    setNewName('');
    setCreating(false);
  }

  // ── Vista dettaglio di una lista ──────────────────────────────
  if (openList) {
    return (
      <ListDetail
        list={openList}
        onBack={() => setOpenId(null)}
        onRename={onRenameList}
        onDelete={async (id) => { await onDeleteList(id); setOpenId(null); }}
        onRemoveItem={onRemoveFromList}
        onOpenMovie={onOpenMovie}
      />
    );
  }

  // ── Vista indice ──────────────────────────────────────────────
  return (
    <div className="space-y-3">
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
          <button onClick={handleCreate} disabled={!newName.trim()}
            className="shrink-0 px-4 rounded-xl bg-film-accent text-film-black font-semibold text-sm active:scale-95 disabled:opacity-50">
            Crea
          </button>
          <button onClick={() => { setCreating(false); setNewName(''); }}
            className="shrink-0 w-10 flex items-center justify-center rounded-xl border border-film-border text-film-subtle active:bg-film-surface">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-film-border text-film-accent active:bg-film-surface">
          <Plus size={18} /><span className="text-sm font-medium">Nuova lista</span>
        </button>
      )}

      {lists.length === 0 && !creating && (
        <div className="flex flex-col items-center text-center py-12 text-film-muted">
          <ListPlus size={32} className="mb-3 opacity-50" />
          <p className="text-sm">Crea liste tematiche come<br />"Maratona Nolan" o "Da vedere con lei".</p>
          <p className="text-film-subtle text-xs mt-2">Aggiungi film dalla scheda di ogni titolo.</p>
        </div>
      )}

      {lists.map(list => (
        <button key={list.id} onClick={() => setOpenId(list.id)}
          className="w-full flex items-center gap-3 p-2 rounded-xl bg-film-surface border border-film-border active:opacity-70">
          {/* Mini collage di poster */}
          <div className="flex shrink-0">
            {list.items.slice(0, 3).map((it, i) => (
              <div key={it.id}
                className="w-10 h-14 rounded-md overflow-hidden border border-film-border bg-film-card"
                style={{ marginLeft: i === 0 ? 0 : -16, zIndex: 3 - i }}>
                {it.poster_path
                  ? <img src={getImageUrl(it.poster_path, 'w92') || ''} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-sm">🎬</div>}
              </div>
            ))}
            {list.items.length === 0 && (
              <div className="w-10 h-14 rounded-md border border-dashed border-film-border flex items-center justify-center text-film-subtle">
                <ListPlus size={16} />
              </div>
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-film-text text-sm font-semibold truncate">{list.name}</p>
            <p className="text-film-subtle text-xs">{list.items.length} titoli</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function ListDetail({
  list, onBack, onRename, onDelete, onRemoveItem, onOpenMovie,
}: {
  list: MovieList;
  onBack: () => void;
  onRename: (listId: string, name: string) => Promise<void>;
  onDelete: (listId: string) => Promise<void>;
  onRemoveItem: (listId: string, movieId: number) => Promise<void>;
  onOpenMovie: (id: number, mt: 'movie' | 'tv') => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full active:bg-film-surface shrink-0">
          <ChevronLeft size={20} className="text-film-text" />
        </button>
        {editing ? (
          <input
            autoFocus value={name} maxLength={60}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onRename(list.id, name); setEditing(false); } }}
            className="flex-1 bg-film-card border border-film-border rounded-xl px-3 py-2 text-film-text focus:outline-none focus:border-film-accent"
          />
        ) : (
          <h2 className="flex-1 font-display text-xl text-film-text tracking-wide truncate">{list.name}</h2>
        )}
        {editing ? (
          <button onClick={() => { onRename(list.id, name); setEditing(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-full text-film-accent active:bg-film-surface shrink-0">
            <Check size={18} />
          </button>
        ) : (
          <button onClick={() => { setName(list.name); setEditing(true); }}
            className="w-9 h-9 flex items-center justify-center rounded-full text-film-subtle active:bg-film-surface shrink-0">
            <Pencil size={16} />
          </button>
        )}
        <button onClick={() => setConfirmDelete(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-film-subtle active:text-film-red shrink-0">
          <Trash2 size={16} />
        </button>
      </div>

      {confirmDelete && (
        <div className="bg-film-surface border border-film-red/40 rounded-xl p-3 flex items-center gap-2">
          <span className="text-film-text text-sm flex-1">Eliminare "{list.name}"?</span>
          <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg border border-film-border text-film-subtle text-sm active:bg-film-card">Annulla</button>
          <button onClick={() => onDelete(list.id)} className="px-3 py-1.5 rounded-lg bg-film-red text-white text-sm font-semibold active:opacity-80">Elimina</button>
        </div>
      )}

      {/* Grid film */}
      {list.items.length === 0 ? (
        <p className="text-film-muted text-sm text-center py-10">
          Lista vuota. Aggiungi film dalla scheda di un titolo con il pulsante "Lista".
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {list.items.map(it => (
            <div key={it.id} className="relative group">
              <button onClick={() => onOpenMovie(it.id, it.media_type)}
                className="block w-full aspect-[2/3] rounded-xl overflow-hidden border border-film-border bg-film-card active:opacity-80">
                {it.poster_path
                  ? <img src={getImageUrl(it.poster_path, 'w185') || ''} alt={it.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center">
                      <span className="text-2xl">🎬</span>
                      <span className="text-film-subtle text-[10px] mt-1 line-clamp-2">{it.title}</span>
                    </div>}
              </button>
              <button
                onClick={() => onRemoveItem(list.id, it.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-film-black/70 backdrop-blur-sm flex items-center justify-center text-white active:bg-film-red"
                aria-label="Rimuovi dalla lista"
              >
                <X size={13} />
              </button>
              <p className="text-film-subtle text-[10px] mt-1 truncate">{formatYear(it.release_date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
