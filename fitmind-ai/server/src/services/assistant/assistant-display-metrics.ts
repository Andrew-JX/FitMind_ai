const METRIC_WEIGHT_DISPLAY_INCREMENT_KG = 0.5;

export function formatMetricKg(value: number | null): string {
  if (value === null) {
    return "暂无结果";
  }

  const roundedValue =
    Math.round(value / METRIC_WEIGHT_DISPLAY_INCREMENT_KG) *
    METRIC_WEIGHT_DISPLAY_INCREMENT_KG;

  return `${roundedValue.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })} kg`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getDaysSince(value: string): number {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const diff = Math.max(0, Date.now() - date.getTime());

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
