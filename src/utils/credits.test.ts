import { describe, it, expect } from 'vitest';
import { dedupeById, dedupeCrewByDept } from './credits';

describe('dedupeById', () => {
  it('tiene una sola voce per id (prima occorrenza)', () => {
    const out = dedupeById([{ id: 1, n: 'a' }, { id: 1, n: 'b' }, { id: 2, n: 'c' }]);
    expect(out).toEqual([{ id: 1, n: 'a' }, { id: 2, n: 'c' }]);
  });
});

describe('dedupeCrewByDept — preserva i ruoli multipli', () => {
  // Un regista spesso è anche sceneggiatore e produttore sullo stesso film.
  const crew = [
    { id: 1, department: 'Writing', job: 'Writer' },
    { id: 1, department: 'Directing', job: 'Director' },
    { id: 1, department: 'Production', job: 'Producer' },
    { id: 2, department: 'Directing', job: 'Director' },
  ];

  it('lo stesso film compare in OGNI reparto (non sparisce da Directing)', () => {
    const out = dedupeCrewByDept(crew);
    const directing = out.filter(m => m.department === 'Directing');
    expect(directing.map(m => m.id)).toEqual([1, 2]);
    expect(out).toHaveLength(4);
  });

  it('deduplica i doppioni nello stesso reparto', () => {
    const out = dedupeCrewByDept([
      { id: 1, department: 'Directing', job: 'Director' },
      { id: 1, department: 'Directing', job: 'Co-Director' },
    ]);
    expect(out).toHaveLength(1);
  });

  it('il vecchio dedupe-per-id avrebbe perso reparti — questo no', () => {
    const out = dedupeCrewByDept(crew);
    const depts = new Set(out.map(m => m.department));
    expect(depts).toEqual(new Set(['Writing', 'Directing', 'Production']));
  });
});
