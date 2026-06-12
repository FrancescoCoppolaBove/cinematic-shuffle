/**
 * Helper puri per deduplicare le filmografie di una persona (cast/crew).
 * Estratti dal servizio TMDB per poterli testare in isolamento: una regressione
 * qui ha già nascosto metà dei film di regia di un regista.
 */

/** Una voce per id (per il cast: un attore = una voce per film). */
export function dedupeById<T extends { id: number }>(arr: T[]): T[] {
  const seen = new Set<number>();
  return arr.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * Una voce per (id, reparto). Una persona può avere PIÙ ruoli sullo stesso film
 * (un regista è spesso anche sceneggiatore e produttore → 3 voci, stesso id):
 * deduplicando globalmente per id il film sopravvivrebbe in un solo reparto e
 * sparirebbe da "Directing". Così invece compare in OGNI reparto pertinente.
 */
export function dedupeCrewByDept<T extends { id: number; department?: string; job?: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(m => {
    const key = `${m.id}-${m.department ?? m.job ?? 'Other'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
