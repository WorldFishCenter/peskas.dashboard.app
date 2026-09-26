import { DistrictSpeciesHeatmap } from "@/components/charts/district-species-heatmap";
import { LengthFrequency } from "@/components/charts/length-frequency";
import { SpeciesComposition } from "@/components/charts/species-composition";
import { TrophicLevel } from "@/components/charts/trophic-level";

export default function CatchCompositionPage() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpeciesComposition />
        <LengthFrequency />
      </div>
      <DistrictSpeciesHeatmap />
      <TrophicLevel />
    </>
  );
}
