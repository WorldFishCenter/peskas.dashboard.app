import { SharksAndRays, SpeciesStatusTable, VulnerabilityBands } from "@/components/charts/vulnerable-species";

export default function VulnerableSpeciesPage() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VulnerabilityBands />
        <SharksAndRays />
      </div>
      <SpeciesStatusTable />
    </>
  );
}
