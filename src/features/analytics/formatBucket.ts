import type { AnalyticsRange } from '@/src/repos/types';

export function formatBucketLabel(date: Date, range: AnalyticsRange): string {
  switch (range) {
    case 'day':
      return `${date.getMonth() + 1}/${date.getDate()}`;
    case 'week':
      return `${date.toLocaleDateString(undefined, { month: 'short' })} ${date.getDate()}`;
    case 'month':
      return date.toLocaleDateString(undefined, { month: 'short' });
  }
}

export function deltaLabel(range: AnalyticsRange): string {
  switch (range) {
    case 'day':
      return 'vs previous day';
    case 'week':
      return 'vs previous week';
    case 'month':
      return 'vs previous month';
  }
}
