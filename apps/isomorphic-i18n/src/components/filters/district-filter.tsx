import { useMemo } from "react";
import { MapPinnedIcon } from "lucide-react";
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
import { ALL_DISTRICTS, REGION_GROUPS, regionLabel, selectionLabel } from "@/lib/dashboard/regions";
import { trackEvent } from "@/lib/analytics";
import { useScope } from "@/store/filters";
import { api } from "@/trpc/react";

type RegionGroup = (typeof REGION_GROUPS)[number];

export function DistrictFilter() {
  const { t } = useT();
  const { districts, months, setDistricts } = useScope();
  const label = selectionLabel(t, districts);
  const total = ALL_DISTRICTS.length;

  // Districts with no landings in the time range get a note, so picking one doesn't open empty charts.
  const { data: coverage } = api.summaries.coverage.useQuery({ months });
  const surveyed = useMemo(() => new Set(coverage?.cells.map((c) => c.district)), [coverage]);

  const change = (next: string[], action: string, extra: Record<string, string> = {}) => {
    trackEvent("filter_district_change", { action, district_count: next.length, ...extra });
    setDistricts(next);
  };

  const handleChange = (next: string[]) => {
    const added = next.find((d) => !districts.includes(d));
    const district = added ?? districts.find((d) => !next.includes(d));
    change(next, added ? "add" : "remove", district ? { district } : {});
  };

  const toggleRegion = (group: RegionGroup) => {
    const allSelected = group.items.every((d) => districts.includes(d));
    const next = allSelected
      ? districts.filter((d) => !group.items.includes(d))
      : Array.from(new Set([...districts, ...group.items]));
    change(next, allSelected ? "region_remove" : "region_add", { peskas_region: group.value });
  };

  return (
    <Combobox items={REGION_GROUPS} multiple value={districts} onValueChange={handleChange}>
      <ComboboxTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={t("text-districts")}
      >
        <MapPinnedIcon data-icon="inline-start" />
        <span className="max-w-48 truncate">{label}</span>
      </ComboboxTrigger>
      <ComboboxContent align="end" className="w-72">
        <ComboboxInput showTrigger={false} placeholder={t("text-search-districts")} />
        <ComboboxEmpty>{t("text-no-districts-found")}</ComboboxEmpty>
        <ComboboxList>
          {(group: RegionGroup, index: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel className="flex items-center justify-between">
                {regionLabel(t, group.value)}
                <Button variant="ghost" size="xs" onClick={() => toggleRegion(group)}>
                  {group.items.every((d) => districts.includes(d))
                    ? t("text-clear")
                    : t("text-all")}
                </Button>
              </ComboboxLabel>
              <ComboboxCollection>
                {(district: string) => (
                  <ComboboxItem key={district} value={district}>
                    <span className="flex-1">{district}</span>
                    {coverage && !surveyed.has(district) && (
                      <span className="text-xs text-muted-foreground">{t("text-no-landings")}</span>
                    )}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
              {index < REGION_GROUPS.length - 1 && <ComboboxSeparator />}
            </ComboboxGroup>
          )}
        </ComboboxList>
        <Separator />
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span>{t("text-districts-selected", { count: districts.length, total })}</span>
          <span className="flex gap-1">
            {districts.length < total && (
              <Button variant="ghost" size="xs" onClick={() => change(ALL_DISTRICTS, "select_all")}>
                {t("text-select-all")}
              </Button>
            )}
            {districts.length > 0 && (
              <Button variant="ghost" size="xs" onClick={() => change([], "clear")}>
                {t("text-clear-all")}
              </Button>
            )}
          </span>
        </div>
      </ComboboxContent>
    </Combobox>
  );
}
