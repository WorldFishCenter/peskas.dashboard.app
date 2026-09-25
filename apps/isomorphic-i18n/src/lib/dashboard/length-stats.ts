export type TaxaRow = {
  gaul_2_name: string;
  catch_taxon: string;
  scientific_name?: string;
  mean_length?: number;
  catch_kg?: number;
};

export type LengthStats = {
  name: string;
  scientificName?: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  districts: number;
  totalCatch: number;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Species with length data, ranked by total catch (largest first). */
export function rankSpeciesByCatch(rows: TaxaRow[]) {
  const species = new Map<string, { name: string; scientificName?: string; totalCatch: number }>();
  for (const row of rows) {
    if (!row.catch_taxon || !(Number(row.mean_length) > 0)) continue;
    const entry = species.get(row.catch_taxon) ?? {
      name: row.catch_taxon,
      scientificName: row.scientific_name,
      totalCatch: 0,
    };
    entry.totalCatch += Number(row.catch_kg) || 0;
    species.set(row.catch_taxon, entry);
  }
  return Array.from(species.values()).sort((a, b) => b.totalCatch - a.totalCatch);
}

/**
 * Box-plot statistics over the district mean lengths of each selected species.
 * Quartiles are index picks on the sorted values (not interpolated).
 */
export function computeLengthStats(rows: TaxaRow[], selected: string[]): LengthStats[] {
  return selected
    .map((name): LengthStats | null => {
      // Only rows with a length, so totals and ranking agree with rankSpeciesByCatch.
      const speciesRows = rows.filter((r) => r.catch_taxon === name && Number(r.mean_length) > 0);
      const lengths = speciesRows.map((r) => Number(r.mean_length)).sort((a, b) => a - b);
      if (!lengths.length) return null;
      const n = lengths.length;
      const mean = lengths.reduce((a, b) => a + b, 0) / n;
      const min = lengths[0];
      const max = lengths[n - 1];
      return {
        name,
        scientificName: speciesRows[0]?.scientific_name,
        min: round1(min),
        q1: round1(lengths[Math.floor(n * 0.25)] || min),
        median: round1(lengths[Math.floor(n * 0.5)] || mean),
        q3: round1(lengths[Math.floor(n * 0.75)] || max),
        max: round1(max),
        mean: round1(mean),
        districts: n,
        totalCatch: speciesRows.reduce((sum, r) => sum + (Number(r.catch_kg) || 0), 0),
      };
    })
    .filter((s): s is LengthStats => s !== null)
    .sort((a, b) => b.totalCatch - a.totalCatch);
}
