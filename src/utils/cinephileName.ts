/**
 * cinephileName — generates an evocative "cinephile name" from the user's taste:
 * an archetype from the dominant genre + a modifier (language / decade).
 * E.g. "Dramatic Soul", "World Explorer of the 80s", "Dark Soul of Korean cinema".
 */
export interface CinephileNameInput {
  topGenreIds: number[];
  topDecade?: string;      // e.g. "1990s"
  topLangCode?: string;    // ISO 639-1 (e.g. "ja")
  watchedCount: number;
}

const ARCHETYPE: Record<number, string> = {
  28: 'Action Hero',
  12: 'Adventurer',
  16: 'Animation Dreamer',
  35: 'Bright Spirit',
  80: 'Shadow Detective',
  99: 'Curious Mind',
  18: 'Dramatic Soul',
  10751: 'Gentle Soul',
  14: 'Fantasy Voyager',
  36: 'Time Traveler',
  27: 'Dark Soul',
  10402: 'Musical Soul',
  9648: 'Mystery Solver',
  10749: 'Hopeless Romantic',
  878: 'World Explorer',
  53: 'Thrill Seeker',
  10752: 'War Strategist',
  37: 'Frontier Spirit',
  // TV genres
  10759: 'Adventurer',
  10765: 'World Explorer',
  10768: 'War Strategist',
  10762: 'Gentle Soul',
};

// "Character" languages: if dominant, they define the modifier.
const CINEMA_OF: Record<string, string> = {
  ja: 'of Japanese cinema',
  ko: 'of Korean cinema',
  fr: 'of French cinema',
  it: 'of Italian cinema',
  es: 'of Spanish cinema',
  de: 'of German cinema',
  zh: 'of Chinese cinema',
  hi: 'of Indian cinema',
  sv: 'of Nordic cinema',
  da: 'of Nordic cinema',
  ru: 'of Russian cinema',
  fa: 'of Iranian cinema',
};

function decadeLabel(decade?: string): string | null {
  if (!decade) return null;
  const start = parseInt(decade);
  if (Number.isNaN(start)) return null;
  return `of the ${String(start).slice(-2)}s`;
}

export function cinephileName(input: CinephileNameInput): { name: string; subtitle: string } {
  const base = ARCHETYPE[input.topGenreIds[0]] ?? 'Eclectic Cinephile';

  // Modifier: a "character" language (non-English) takes priority, then decade.
  let modifier = '';
  const lang = input.topLangCode;
  if (lang && lang !== 'en' && CINEMA_OF[lang]) {
    modifier = CINEMA_OF[lang];
  } else {
    const dec = decadeLabel(input.topDecade);
    if (dec) modifier = dec;
  }

  const name = modifier ? `${base} ${modifier}` : base;

  // Subtitle based on how deep/wide the library is
  const c = input.watchedCount;
  const subtitle = c >= 500 ? 'Legendary cinephile'
    : c >= 200 ? 'Die-hard cinephile'
    : c >= 80 ? 'True movie buff'
    : c >= 30 ? 'Keen viewer'
    : 'Budding explorer';

  return { name, subtitle };
}
