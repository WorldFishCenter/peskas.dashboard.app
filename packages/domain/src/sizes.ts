/**
 * Size at capture against the sizes that matter for a stock (see Length class,
 * Length at maturity and Optimum length in CONTEXT.md): Froese's (2004)
 * indicators of fish caught before maturity, at optimum length, and as large
 * spawners. Pure functions over the length summaries, shared by the species
 * and gear views.
 */

/** Recorded catch in one length class; the open top class has no upper bound. */
export type LengthClass = { length_min: number; length_max?: number | null; catch_kg: number };

/** Fewer measured trips than this behind a species or gear and its size views leave it out. */
export const MIN_MEASURED_TRIPS = 10;

/** A span of lengths in cm, `to` excluded; `Infinity` for no upper bound. */
export type Band = { from: number; to: number };

/**
 * Froese's bands: below the length at maturity, within 10% of the optimum
 * length (where a cohort's biomass peaks), and beyond it (large spawners).
 */
export function froeseBands(maturityCm?: number | null, optimumCm?: number | null) {
  return {
    immature: maturityCm ? { from: 0, to: maturityCm } : null,
    optimum: optimumCm ? { from: 0.9 * optimumCm, to: 1.1 * optimumCm } : null,
    megaspawners: optimumCm ? { from: 1.1 * optimumCm, to: Infinity } : null,
  };
}

/**
 * Least and most share (0–1) of the catch weight that can lie in a band.
 * Classes are 5 to 10 cm wide, so a class that straddles an edge holds fish
 * on both sides: it counts towards the most, never the least. Null with no catch.
 */
export function shareInBand(classes: readonly LengthClass[], band: Band): { least: number; most: number } | null {
  let least = 0;
  let most = 0;
  let total = 0;
  for (const c of classes) {
    const max = c.length_max ?? Infinity;
    total += c.catch_kg;
    if (c.length_min >= band.from && max <= band.to) least += c.catch_kg;
    if (c.length_min < band.to && max > band.from) most += c.catch_kg;
  }
  return total > 0 ? { least: least / total, most: most / total } : null;
}

/** Where a length class sits against the length at maturity; one that straddles it can't be placed. */
export type MaturityPosition = "below" | "spanning" | "above";
export function maturityPosition(c: Pick<LengthClass, "length_min" | "length_max">, maturityCm: number): MaturityPosition {
  if (c.length_max != null && c.length_max <= maturityCm) return "below";
  if (c.length_min >= maturityCm) return "above";
  return "spanning";
}

/** Length classes of one taxon and gear, with the trips measured behind them. */
export type MeasuredCatch = { taxon: string; gear: string | null; classes: LengthClass[]; trips: number };

/**
 * Per gear, the least and most share of the measured catch below maturity,
 * counting only taxa with a known maturity length, and the trips behind it.
 * Gears with fewer than MIN_MEASURED_TRIPS are left out.
 */
export function immatureByGear(measured: readonly MeasuredCatch[], maturity: Record<string, number>) {
  const gears = new Map<string | null, { least: number; most: number; kg: number; trips: number }>();
  for (const m of measured) {
    const lm = maturity[m.taxon];
    const share = lm ? shareInBand(m.classes, { from: 0, to: lm }) : null;
    if (!share) continue;
    const kg = m.classes.reduce((sum, c) => sum + c.catch_kg, 0);
    const g = gears.get(m.gear) ?? { least: 0, most: 0, kg: 0, trips: 0 };
    g.least += share.least * kg;
    g.most += share.most * kg;
    g.kg += kg;
    g.trips += m.trips;
    gears.set(m.gear, g);
  }
  return [...gears]
    .filter(([, g]) => g.trips >= MIN_MEASURED_TRIPS)
    .map(([gear, g]) => ({ gear, least: g.least / g.kg, most: g.most / g.kg, trips: g.trips }))
    .sort((a, b) => b.least - a.least);
}
