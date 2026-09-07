/** Small pure helpers shared by the analytics service. */

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((s, v) => s + v, 0) / values.length);
}

export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return round1((part / whole) * 100);
}
