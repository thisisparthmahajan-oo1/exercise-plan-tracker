// The fixed catalog of trackable body metrics. This is the single source of
// truth for which metrics exist, their display labels, units, and grouping.
// The DB stores rows keyed by these `BodyMetricKey`s (see `body_metric_logs`
// in src/db/schema.ts); the log form and dashboard both render from this map.
// Add a metric here and it flows through the whole feature — no other file
// enumerates the list.

export type BodyMetricUnit = 'kg' | '%' | 'in';

export type BodyMetricDef = {
  key: BodyMetricKey;
  label: string;
  unit: BodyMetricUnit;
  group: string;
};

// Ordered — drives the sequence of cards/inputs in the UI.
export const BODY_METRICS = {
  weight: { label: 'Weight', unit: 'kg', group: 'Body' },
  bodyFat: { label: 'Body Fat', unit: '%', group: 'Body' },

  neck: { label: 'Neck', unit: 'in', group: 'Upper' },
  shoulders: { label: 'Shoulders', unit: 'in', group: 'Upper' },
  chest: { label: 'Chest', unit: 'in', group: 'Upper' },

  bicepL: { label: 'Bicep L', unit: 'in', group: 'Arms' },
  bicepR: { label: 'Bicep R', unit: 'in', group: 'Arms' },
  forearmL: { label: 'Forearm L', unit: 'in', group: 'Arms' },
  forearmR: { label: 'Forearm R', unit: 'in', group: 'Arms' },

  waist: { label: 'Waist', unit: 'in', group: 'Core' },
  hips: { label: 'Hips', unit: 'in', group: 'Core' },

  thighL: { label: 'Thigh L', unit: 'in', group: 'Legs' },
  thighR: { label: 'Thigh R', unit: 'in', group: 'Legs' },
  calfL: { label: 'Calf L', unit: 'in', group: 'Legs' },
  calfR: { label: 'Calf R', unit: 'in', group: 'Legs' },
} as const satisfies Record<string, { label: string; unit: BodyMetricUnit; group: string }>;

export type BodyMetricKey = keyof typeof BODY_METRICS;

export const BODY_METRIC_KEYS = Object.keys(BODY_METRICS) as BodyMetricKey[];

export function isBodyMetricKey(v: string): v is BodyMetricKey {
  return v in BODY_METRICS;
}

export function metricDef(key: BodyMetricKey): BodyMetricDef {
  return { key, ...BODY_METRICS[key] };
}

// Ordered groups → member keys, preserving the insertion order above. Used to
// lay out the log form and dashboard in labeled sections.
export const BODY_METRIC_GROUPS: { group: string; keys: BodyMetricKey[] }[] = (() => {
  const out: { group: string; keys: BodyMetricKey[] }[] = [];
  for (const key of BODY_METRIC_KEYS) {
    const group = BODY_METRICS[key].group;
    const last = out[out.length - 1];
    if (last && last.group === group) last.keys.push(key);
    else out.push({ group, keys: [key] });
  }
  return out;
})();

// Human-facing value formatting. Weight/% get a trailing unit; inch sites use a
// double-prime suffix. Trims trailing zeros (72.50 → "72.5", 15.0 → "15").
export function formatMetricValue(key: BodyMetricKey, value: number): string {
  const { unit } = BODY_METRICS[key];
  const num = trimNumber(value);
  switch (unit) {
    case 'kg':
      return `${num} kg`;
    case '%':
      return `${num}%`;
    case 'in':
      return `${num}"`;
  }
}

function trimNumber(value: number): string {
  return Number.parseFloat(value.toFixed(2)).toString();
}
