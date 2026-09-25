import { useAtom } from "jotai";
import { MapPinnedIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@workspace/ui/components/combobox";
import { useT } from "@/i18n/use-lang";
import { ALL_DISTRICTS, REGION_GROUPS } from "@/lib/dashboard/regions";
import { trackEvent } from "@/lib/analytics";
import { districtsAtom } from "@/store/filters";

type RegionGroup = (typeof REGION_GROUPS)[number];

export function DistrictFilter() {
  const { t } = useT();
  const [districts, setDistricts] = useAtom(districtsAtom);
  const selected = districts.length;
  const total = ALL_DISTRICTS.length;

  const handleChange = (next: string[]) => {
    const added = next.find((d) => !districts.includes(d));
    const district = added ?? districts.find((d) => !next.includes(d));
    trackEvent("filter_district_change", {
      action: added ? "add" : "remove",
      ...(district && { district }),
      district_count: next.length,
    });
    setDistricts(next);
  };

  const toggleRegion = (group: RegionGroup) => {
    const allSelected = group.items.every((d) => districts.includes(d));
    const next = allSelected
      ? districts.filter((d) => !group.items.includes(d))
      : Array.from(new Set([...districts, ...group.items]));
    trackEvent("filter_district_change", {
      action: allSelected ? "region_remove" : "region_add",
      peskas_region: group.value,
      district_count: next.length,
    });
    setDistricts(next);
  };

  const clearAll = () => {
    trackEvent("filter_district_change", { action: "clear", district_count: 0 });
    setDistricts([]);
  };

  return (
    <Combobox items={REGION_GROUPS} multiple value={districts} onValueChange={handleChange}>
      <ComboboxTrigger render={<Button variant="outline" size="sm" />}>
        <MapPinnedIcon data-icon="inline-start" />
        {t("text-districts")}
        {selected > 0 && selected < total && <Badge variant="secondary">{selected}</Badge>}
      </ComboboxTrigger>
      <ComboboxContent align="end" className="w-72">
        <ComboboxInput showTrigger={false} placeholder={t("text-search-districts")} />
        <ComboboxEmpty>{t("text-no-districts-found")}</ComboboxEmpty>
        <ComboboxList>
          {(group: RegionGroup, index: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel className="flex items-center justify-between">
                {group.value}
                <Button variant="ghost" size="xs" onClick={() => toggleRegion(group)}>
                  {group.items.every((d) => districts.includes(d)) ? t("text-clear") : t("text-all")}
                </Button>
              </ComboboxLabel>
              <ComboboxCollection>
                {(district: string) => (
                  <ComboboxItem key={district} value={district}>
                    {district}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
              {index < REGION_GROUPS.length - 1 && <ComboboxSeparator />}
            </ComboboxGroup>
          )}
        </ComboboxList>
        <Separator />
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span>{t("text-districts-selected", { count: selected, total })}</span>
          {selected > 0 && (
            <Button variant="ghost" size="xs" onClick={clearAll}>
              {t("text-clear-all")}
            </Button>
          )}
        </div>
      </ComboboxContent>
    </Combobox>
  );
}
