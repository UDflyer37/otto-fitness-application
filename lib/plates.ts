/** Standard US pound plates, heaviest first. */
export const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5];

export const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

/** Rounds a computed bar weight to the nearest 5 lb, like a real rack. */
export const roundToPlate = (value: number) => Math.max(0, Math.round(value / 5) * 5);

export type PlateLoad = { plate: number; count: number };

export type PlateResult = {
  /** Plates to load on ONE side of the bar. */
  loads: PlateLoad[];
  loadedPerSide: number;
  /** Total weight actually achievable with the available plates. */
  achieved: number;
  /** How far short of the target we landed, in lb. */
  short: number;
};

/**
 * Greedy plate math: target total weight -> plates per side.
 * Mirrors the original Anvil calculator but returns structured data and
 * reports the closest achievable weight when the target cannot be hit.
 */
export function plateBreakdown(target: number, barWeight: number, plates: number[]): PlateResult {
  const available = [...plates].sort((a, b) => b - a);
  const perSideTarget = Math.max(0, (target - barWeight) / 2);

  let remaining = perSideTarget;
  const loads: PlateLoad[] = [];

  for (const plate of available) {
    const count = Math.floor(round(remaining / plate, 6));
    if (count > 0) {
      loads.push({ plate, count });
      remaining = round(remaining - count * plate);
    }
    if (remaining <= 0) break;
  }

  const loadedPerSide = round(loads.reduce((sum, load) => sum + load.count * load.plate, 0));
  const achieved = round(barWeight + loadedPerSide * 2);

  return {
    loads,
    loadedPerSide,
    achieved,
    short: Math.max(0, round(target - achieved)),
  };
}

/** Total weight on the bar from per-side plate counts. */
export function barTotal(counts: Record<number, number>, barWeight: number, plates: number[]) {
  const perSide = plates.reduce((sum, plate) => sum + plate * (counts[plate] ?? 0), 0);
  return round(barWeight + perSide * 2);
}

/** Epley formula: 1RM = weight x (1 + reps / 30). */
export function oneRepMax(weight: number, reps: number) {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
