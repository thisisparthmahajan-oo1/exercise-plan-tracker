// Local calendar-date helpers for body logging. Body metrics are keyed by a
// local 'YYYY-MM-DD' string, so we deliberately avoid `toISOString()` (which is
// UTC and can land on the wrong day in negative-offset timezones).

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

// Parse a 'YYYY-MM-DD' string into a Date at local midnight.
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftISO(iso: string, days: number): string {
  const d = isoToLocalDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
