/**
 * cinephileName — genera un "nome da cinefilo" evocativo dai gusti dell'utente:
 * un archetipo dal genere dominante + un modificatore (lingua/decade/2° genere).
 * Es. "Cacciatore di brividi", "Esploratore di mondi anni '80",
 * "Anima oscura del cinema coreano".
 */
export interface CinephileNameInput {
  topGenreIds: number[];
  topDecade?: string;      // es. "1990s"
  topLangCode?: string;    // ISO 639-1 (es. "ja")
  watchedCount: number;
}

const ARCHETYPE: Record<number, string> = {
  28: "Eroe d'azione",
  12: 'Avventuriero',
  16: 'Sognatore animato',
  35: 'Spirito brillante',
  80: "Detective dell'ombra",
  99: 'Mente curiosa',
  18: 'Cuore drammatico',
  10751: 'Anima gentile',
  14: 'Viaggiatore fantastico',
  36: 'Viaggiatore nel tempo',
  27: 'Anima oscura',
  10402: 'Anima musicale',
  9648: 'Investigatore',
  10749: 'Romantico inguaribile',
  878: 'Esploratore di mondi',
  53: 'Cacciatore di brividi',
  10752: 'Stratega di guerra',
  37: 'Spirito di frontiera',
  // generi TV
  10759: 'Avventuriero',
  10765: 'Esploratore di mondi',
  10768: 'Stratega di guerra',
  10762: 'Anima gentile',
};

// Lingue "di carattere": se dominano, definiscono il modificatore.
const CINEMA_OF: Record<string, string> = {
  ja: 'del cinema giapponese',
  ko: 'del cinema coreano',
  fr: 'del cinema francese',
  it: 'del cinema italiano',
  es: 'del cinema spagnolo',
  de: 'del cinema tedesco',
  zh: 'del cinema cinese',
  hi: 'del cinema indiano',
  sv: 'del cinema scandinavo',
  da: 'del cinema scandinavo',
  ru: 'del cinema russo',
  fa: 'del cinema iraniano',
};

function decadeLabel(decade?: string): string | null {
  if (!decade) return null;
  const start = parseInt(decade);
  if (Number.isNaN(start)) return null;
  return start >= 2000 ? `anni ${start}` : `anni '${String(start).slice(2)}`;
}

export function cinephileName(input: CinephileNameInput): { name: string; subtitle: string } {
  const base = ARCHETYPE[input.topGenreIds[0]] ?? 'Cinefilo eclettico';

  // Modificatore: lingua di carattere (non inglese) ha priorità, poi decade.
  let modifier = '';
  const lang = input.topLangCode;
  if (lang && lang !== 'en' && CINEMA_OF[lang]) {
    modifier = CINEMA_OF[lang];
  } else {
    const dec = decadeLabel(input.topDecade);
    if (dec) modifier = dec;
  }

  const name = modifier ? `${base} ${modifier}` : base;

  // Sottotitolo in base a quanto è ampia/profonda la cineteca
  const c = input.watchedCount;
  const subtitle = c >= 500 ? 'Cinefilo da leggenda'
    : c >= 200 ? 'Cinefilo incallito'
    : c >= 80 ? 'Vero appassionato'
    : c >= 30 ? 'Spettatore attento'
    : 'Esploratore in erba';

  return { name, subtitle };
}
