import type { DataPoint } from '@/lib/grid-map/types';

/** Summary shown in the map info panel. Raw numbers; format at render time. */
export function calculateStats(data: DataPoint[]) {
  const n = data.length || 1;
  return {
    totalVisits: data.reduce((sum, d) => sum + (d.totalVisits || 0), 0),
    gridCells: data.length,
    avgTime: data.reduce((sum, d) => sum + (d.avgTimeHours || 0), 0) / n,
    maxTime: Math.max(...data.map((d) => d.avgTimeHours || 0), 0),
    avgSpeed: data.reduce((sum, d) => sum + (d.avgSpeed || 0), 0) / n,
  };
}
