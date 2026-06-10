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
  28: 'Action Hero',
  12: 'Adventurer',
  16: 'Animated Dreamer',
  35: 'Bright Spirit',
  80: 'Shadow Detective',
  99: 'Curious Mind',
  18: 'Dramatic Heart',
  10751: 'Gentle Soul',
  14: 'Fantasy Traveler',
  36: 'Time Traveler',
  27: 'Dark Soul',
  10402: 'Musical Soul',
  9648: 'Investigator',
  10749: 'Hopeless Romantic',
  878: 'World Explorer',
  53: 'Thrill Seeker',
  10752: 'War Strategist',
  37: 'Frontier Spirit',
  // generi TV
  10759: 'Adventurer',
  10765: 'World Explorer',
  10768: 'War Strategist',
  10762: 'Gentle Soul',
};

// Lingue "di carattere": se dominano, definiscono il modificatore.
const CINEMA_OF: Record<string, string> = {
  ja: 'of Japanese Cinema',
  ko: 'of Korean Cinema',
  fr: 'of French Cinema',
  it: 'of Italian Cinema',
  es: 'of Spanish Cinema',
  de: 'of German Cinema',
  zh: 'of Chinese Cinema',
  hi: 'of Indian Cinema',
  sv: 'of Scandinavian Cinema',
  da: 'of Scandinavian Cinema',
  ru: 'of Russian Cinema',
  fa: 'of Iranian Cinema',
};

function decadeLabel(decade?: string): string | null {
  if (!decade) return null;
  const start = parseInt(decade);
  if (Number.isNaN(start)) return null;
  return `${start}s`;
}

export function cinephileName(input: CinephileNameInput): { name: string; subtitle: string } {
  const base = ARCHETYPE[input.topGenreIds[0]] ?? 'Eclectic Cinephile';

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
  const subtitle = c >= 500 ? 'Legendary Cinephile'
    : c >= 200 ? 'Seasoned Cinephile'
    : c >= 80 ? 'True Enthusiast'
    : c >= 30 ? 'Attentive Viewer'
    : 'New Explorer';

  return { name, subtitle };
}
