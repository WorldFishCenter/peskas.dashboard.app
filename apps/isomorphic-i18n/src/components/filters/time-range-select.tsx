import { useAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { selectedTimeRangeAtom, TIME_RANGE_OPTIONS, type TimeRange } from "@/store/time-range";

export function TimeRangeSelect() {
  const { t } = useT();
  const [range, setRange] = useAtom(selectedTimeRangeAtom);
  const items = TIME_RANGE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  return (
    <Select<TimeRange>
      items={items}
      value={range}
      onValueChange={(value) => {
        // Re-picking the current range is not a filter change.
        if (value === null || value === range) return;
        trackEvent("filter_time_range_change", { time_range: String(value) });
        setRange(value);
      }}
    >
      <SelectTrigger size="sm" aria-label={t("text-time-range")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={String(item.value)} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
