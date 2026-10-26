import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { bodyMetricLogs } from '@/src/db/schema';
import { isoToLocalDate } from '@/src/features/body/date';
import { isBodyMetricKey } from '@/src/features/body/metrics';
import type {
  BodyEntryInput,
  BodyLatest,
  BodyMetricKey,
  BodyRepo,
  TimeSeriesPoint,
} from '@/src/repos/types';
import { bodyEntryInputSchema } from '@/src/repos/types';

// Natural-key id: one row per (metric, day) on every device, so two offline
// devices logging the same day converge on one row under sync instead of
// colliding on the (metric, date) unique index.
function bodyMetricLogId(metric: BodyMetricKey, date: string): string {
  return `${metric}:${date}`;
}

export const sqliteBodyRepo: BodyRepo = {
  async getDay(date: string): Promise<Partial<Record<BodyMetricKey, number>>> {
    const rows = await db
      .select({ metric: bodyMetricLogs.metric, value: bodyMetricLogs.value })
      .from(bodyMetricLogs)
      .where(eq(bodyMetricLogs.date, date));

    const out: Partial<Record<BodyMetricKey, number>> = {};
    for (const r of rows) {
      if (isBodyMetricKey(r.metric)) out[r.metric] = r.value;
    }
    return out;
  },

  async logEntry(input: BodyEntryInput): Promise<void> {
    const { date, values } = bodyEntryInputSchema.parse(input);
    const entries = Object.entries(values) as [BodyMetricKey, number | null | undefined][];

    await db.transaction(async (tx) => {
      for (const [metric, value] of entries) {
        if (value == null) {
          // Explicit null (or absent) clears the metric for this day.
          await tx
            .delete(bodyMetricLogs)
            .where(and(eq(bodyMetricLogs.metric, metric), eq(bodyMetricLogs.date, date)));
          continue;
        }
        await tx
          .insert(bodyMetricLogs)
          .values({ id: bodyMetricLogId(metric, date), metric, value, date })
          .onConflictDoUpdate({
            target: [bodyMetricLogs.metric, bodyMetricLogs.date],
            set: { value },
          });
      }
    });
  },

  async latest(): Promise<BodyLatest[]> {
    // One row per metric — the value on its most recent date. `date` is a
    // 'YYYY-MM-DD' text, so lexical MAX equals chronological MAX.
    const rows = await db.all<{ metric: string; value: number; date: string }>(sql`
      SELECT metric, value, date
      FROM body_metric_logs b
      WHERE date = (
        SELECT MAX(date) FROM body_metric_logs WHERE metric = b.metric
      )
    `);

    return rows
      .filter((r) => isBodyMetricKey(r.metric))
      .map((r) => ({ metric: r.metric as BodyMetricKey, value: r.value, date: r.date }));
  },

  async history(metric: BodyMetricKey): Promise<TimeSeriesPoint[]> {
    const rows = await db
      .select({ value: bodyMetricLogs.value, date: bodyMetricLogs.date })
      .from(bodyMetricLogs)
      .where(eq(bodyMetricLogs.metric, metric))
      .orderBy(asc(bodyMetricLogs.date));

    return rows.map((r) => ({ bucketStart: isoToLocalDate(r.date), value: r.value }));
  },
};
