import { sql } from 'drizzle-orm';

import { db } from '@/src/db/client';
import type {
  AnalyticsMetric,
  AnalyticsRange,
  AnalyticsRepo,
  TimeSeriesPoint,
} from '@/src/repos/types';

function bucketFormat(range: AnalyticsRange): string {
  switch (range) {
    case 'day':
      return '%Y-%m-%d';
    case 'week':
      return '%Y-%W';
    case 'month':
      return '%Y-%m';
  }
}

function rangeStartMs(range: AnalyticsRange, now: number): number {
  const day = 86_400_000;
  switch (range) {
    case 'day':
      return now - 14 * day;
    case 'week':
      return now - 12 * 7 * day;
    case 'month':
      return now - 365 * day;
  }
}

function metricExpression(metric: AnalyticsMetric) {
  return metric === 'volume'
    ? sql`SUM(reps * weight)`
    : sql`MAX(weight)`;
}

export const sqliteAnalyticsRepo: AnalyticsRepo = {
  async series({ exerciseId, metric, range }): Promise<TimeSeriesPoint[]> {
    const fmt = bucketFormat(range);
    const since = rangeStartMs(range, Date.now());
    const valueExpr = metricExpression(metric);

    const rows = await db.all<{ bucket_start: number; value: number }>(sql`
      SELECT
        MIN(completed_at) AS bucket_start,
        ${valueExpr} AS value
      FROM set_logs
      WHERE exercise_id = ${exerciseId}
        AND completed_at >= ${since}
      GROUP BY strftime(${fmt}, completed_at / 1000, 'unixepoch')
      ORDER BY bucket_start ASC
    `);

    return rows.map((r) => ({
      bucketStart: new Date(r.bucket_start),
      value: r.value,
    }));
  },
};
