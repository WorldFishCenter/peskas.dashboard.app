export interface TimeBreak {
  min: number;
  max: number;
  label: string;
}

export interface DataPoint {
  position: [number, number];
  avgTimeHours: number;
  totalVisits: number;
  avgSpeed: number;
}

export interface ChoroplethLegend {
  colors: [number, number, number][];
  metricLabel: string;
  minLabel: string;
  maxLabel: string;
}
