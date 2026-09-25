"use client";

import { DistrictSpeciesHeatmap } from "@/components/charts/district-species-heatmap";
import { LengthDistribution } from "@/components/charts/length-distribution";
import { SpeciesComposition } from "@/components/charts/species-composition";

export default function CatchCompositionPage() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpeciesComposition />
        <LengthDistribution />
      </div>
      <DistrictSpeciesHeatmap />
    </>
  );
}
