import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { DistrictSpeciesHeatmap } from "@/components/charts/district-species-heatmap";
import { SpeciesSizes } from "@/components/charts/length-frequency";
import { SpeciesRanking } from "@/components/charts/species-ranking";
import { TrophicLevel } from "@/components/charts/trophic-level";
import { useT } from "@/i18n/use-lang";

/** Species and sizes: one question per tab, so each fits a screen. */
export default function CatchCompositionPage() {
  const { t } = useT();
  return (
    <Tabs defaultValue="caught" className="gap-4">
      <TabsList className="print:hidden">
        <TabsTrigger value="caught">{t("tab-species-caught")}</TabsTrigger>
        <TabsTrigger value="sizes">{t("tab-species-sizes")}</TabsTrigger>
        <TabsTrigger value="foodweb">{t("tab-species-foodweb")}</TabsTrigger>
      </TabsList>
      <TabsContent value="caught" className="flex flex-col gap-4">
        <SpeciesRanking />
        <DistrictSpeciesHeatmap />
      </TabsContent>
      <TabsContent value="sizes">
        <SpeciesSizes />
      </TabsContent>
      <TabsContent value="foodweb">
        <TrophicLevel />
      </TabsContent>
    </Tabs>
  );
}
