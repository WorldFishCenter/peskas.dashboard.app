import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { activeCountry } from "@/config/countryConfig";
import type { PageMetric } from "@/config/routes";
import type { MetricKey } from "@repo/domain/metrics";

export type TimeRange = 3 | 6 | 12 | "all";
export const TIME_RANGES: TimeRange[] = [3, 6, 12, "all"];
const DEFAULT_RANGE: TimeRange = "all";

const ALL = activeCountry.districts;
const KNOWN = new Set(ALL);

/** The query-string keys that carry the scope from page to page (the metric stays with its page). */
export const SCOPE_PARAMS = ["months", "d"];

function parseRange(raw: string | null): TimeRange {
  if (raw === "all") return "all";
  const n = Number(raw);
  return (TIME_RANGES as unknown[]).includes(n) ? (n as TimeRange) : DEFAULT_RANGE;
}

/**
 * Districts from `d` params: none at all means every district, a lone empty
 * `d=` means the viewer cleared the selection. Names from another country's
 * link are dropped; if nothing valid is left, every district.
 */
function parseDistricts(values: string[]): string[] {
  if (!values.length) return ALL;
  if (values.every((v) => v === "")) return [];
  const valid = [...new Set(values.filter((v) => KNOWN.has(v)))];
  return valid.length ? valid : ALL;
}

/** Edit the query string in place: a filter change replaces the history entry rather than adding one. */
function useEditParams() {
  const [params, setParams] = useSearchParams();
  const edit = useCallback(
    (change: (p: URLSearchParams) => void) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          change(next);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [params, edit] as const;
}

/**
 * The time range and district selection, read from and written to the URL
 * (`?months=12&d=Kati&d=Wete`), so a shared link or a bookmark reproduces the view.
 */
export function useScope() {
  const [params, update] = useEditParams();
  const range = parseRange(params.get("months"));
  const dParams = params.getAll("d");
  const dKey = dParams.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dKey is the content of dParams
  const districts = useMemo(() => parseDistricts(dParams), [dKey]);

  const setRange = useCallback(
    (next: TimeRange) =>
      update((p) => (next === DEFAULT_RANGE ? p.delete("months") : p.set("months", String(next)))),
    [update],
  );

  const setDistricts = useCallback(
    (next: string[]) =>
      update((p) => {
        p.delete("d");
        const unique = [...new Set(next)];
        if (!unique.length) p.append("d", "");
        else if (unique.length < ALL.length) unique.forEach((d) => p.append("d", d));
      }),
    [update],
  );

  return {
    range,
    /** Month count for the summaries; undefined means all time. */
    months: range === "all" ? undefined : range,
    districts,
    setRange,
    setDistricts,
  };
}

/**
 * Query input and options for a card that follows the district selection and
 * the time range. An empty selection disables the query, which ChartGate
 * turns into the "select districts" prompt.
 */
export function useDistrictScope() {
  const { districts, months } = useScope();
  const input = { districts, months };
  return { input, options: { enabled: districts.length > 0 } };
}

/** The page's metric from `?metric=`, one of its options, else its default. */
export function usePageMetric(page: PageMetric): [MetricKey, (next: MetricKey) => void] {
  const [params, edit] = useEditParams();
  const raw = params.get("metric") as MetricKey | null;
  const metric = raw && page.options.includes(raw) ? raw : page.default;
  const setMetric = useCallback(
    (next: MetricKey) =>
      edit((p) => (next === page.default ? p.delete("metric") : p.set("metric", next))),
    [edit, page.default],
  );
  return [metric, setMetric];
}
