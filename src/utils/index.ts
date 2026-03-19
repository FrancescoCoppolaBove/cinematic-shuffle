export function formatRuntime(minutes: number | null): string {
  if (!minutes) return 'N/D';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function formatYear(dateStr: string): string {
  if (!dateStr) return 'N/D';
  return dateStr.split('-')[0];
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
