import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useT } from "@/i18n/use-lang";
import { RangeBar } from "@/components/charts/inline-bars";
import { Legend } from "@/components/charts/legend";
import { WarningIcon } from "@/components/charts/warning-icon";
import { Change } from "@/components/dashboard/stat-tile";
import { formatApprox } from "@/lib/dashboard/format";
import type { Method } from "@repo/domain/metrics";
import { METHOD_COLOR } from "@/lib/dashboard/metrics";
import { MATURITY_FILL } from "@/lib/dashboard/species";

/*
 * The Data and methods page's diagrams. Each one draws what the pipeline and
 * the dashboard do (coasts' summaries and fleet model, the size bands of
 * packages/domain/src/sizes.ts, the chart marks): change them together.
 */

/** A box in a diagram: its name and one line on what it holds. */
function Node({
  name,
  detail,
  shown,
  className,
}: {
  name: string;
  detail?: string;
  /** A figure the dashboard shows, set apart from the steps behind it. */
  shown?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-sm",
        shown && "border-primary/40 bg-primary/5",
        className,
      )}
    >
      <span className="font-medium">{name}</span>
      {detail && <span className="text-[13px] leading-snug text-muted-foreground">{detail}</span>}
    </div>
  );
}

function Arrow({ className }: { className?: string }) {
  return (
    <ArrowRightIcon
      aria-hidden
      className={cn(
        "hidden size-4 self-center justify-self-center text-muted-foreground md:block",
        className,
      )}
    />
  );
}

/**
 * From what is collected to what this dashboard shows, in three columns. On
 * a narrow screen the boxes stack in reading order and the arrows go.
 */
export function DataFlow() {
  const { t } = useT();
  const node = (key: string) => ({
    name: t(`methods-flow-${key}`),
    detail: t(`methods-flow-${key}-detail`),
  });
  const heading = "hidden text-xs font-medium text-muted-foreground md:block";

  return (
    <figure
      aria-label={t("methods-flow-label")}
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_1.5rem_minmax(0,1fr)] md:gap-x-2 print:break-inside-avoid"
    >
      <span className={cn(heading, "md:col-start-1 md:row-start-1")}>
        {t("methods-flow-col-collected")}
      </span>
      <span className={cn(heading, "md:col-start-3 md:row-start-1")}>
        {t("methods-flow-col-processed")}
      </span>
      <span className={cn(heading, "md:col-start-5 md:row-start-1")}>
        {t("methods-flow-col-shown")}
      </span>

      <Node {...node("surveys")} className="md:col-start-1 md:row-start-2" />
      <Arrow className="md:col-start-2 md:row-start-2" />
      <Node {...node("checked")} className="md:col-start-3 md:row-start-2" />
      <Arrow className="md:col-start-4 md:row-start-2" />
      <Node {...node("recorded")} shown className="md:col-start-5 md:row-start-2" />

      {/* The estimates take their catch and value per trip from the recorded figures. */}
      <span className="hidden items-center justify-center gap-1.5 text-xs text-muted-foreground md:col-start-5 md:row-start-3 md:flex">
        <ArrowDownIcon aria-hidden className="size-3.5" />
        {t("methods-flow-per-trip")}
      </span>

      <Node {...node("trackers")} className="md:col-start-1 md:row-start-4" />
      <Arrow className="md:col-start-2 md:row-start-4" />
      <Node {...node("trips")} className="md:col-start-3 md:row-start-4" />
      <Arrow className="md:col-start-4 md:row-start-4" />
      <Node {...node("estimated")} shown className="md:col-start-5 md:row-span-2 md:row-start-4" />

      <Node {...node("boats")} className="md:col-start-1 md:row-start-5" />
      <Arrow className="md:col-start-2 md:row-start-5" />
      <Node {...node("tracked")} className="md:col-start-3 md:row-start-5" />
      <Arrow className="md:col-start-4 md:row-start-5" />

      <Node {...node("fishbase")} className="md:col-start-1 md:row-start-6 md:mt-3" />
      <Arrow className="md:col-start-2 md:row-start-6 md:mt-3" />
      <Node {...node("traits")} className="md:col-start-3 md:row-start-6 md:mt-3" />
      <Arrow className="md:col-start-4 md:row-start-6 md:mt-3" />
      <Node {...node("species")} shown className="md:col-start-5 md:row-start-6 md:mt-3" />
    </figure>
  );
}

function Operator({ children }: { children: string }) {
  return (
    <span aria-hidden className="self-center justify-self-center text-lg text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Each method as two multiplications, its terms as [locale key, source]: the
 * GPS tracker method of coasts' generate_fleet_analysis(), and the FAO ARTFISH
 * method of its raise_catch_fao(), worked out per gear or boat type.
 */
const FORMULAS = {
  tracker: {
    prefix: "methods-formula",
    terms: [
      ["trips-per-boat", "trackers"],
      ["boats", "boats"],
      ["trips"],
      ["per-trip", "surveys"],
      ["totals"],
    ],
  },
  artfish: {
    prefix: "methods-artfish-formula",
    terms: [
      ["boats", "boats"],
      ["days", "surveys"],
      ["effort"],
      ["per-trip", "surveys"],
      ["totals"],
    ],
  },
} as const satisfies Record<Method, { prefix: string; terms: readonly (readonly string[])[] }>;

export function EstimateFormula({ method }: { method: Method }) {
  const { t } = useT();
  const { prefix, terms } = FORMULAS[method];
  const [a, b, product, rate, total] = terms;
  const term = ([key, source]: readonly string[], shown?: boolean) => (
    <Node
      name={t(`${prefix}-${key}`)}
      detail={source && t(`methods-flow-${source}`)}
      shown={shown}
    />
  );
  const row =
    "grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)]";

  return (
    <figure
      aria-label={t(`${prefix}-label`)}
      className="flex flex-col gap-3 print:break-inside-avoid"
    >
      <div className={row}>
        {term(a)}
        <Operator>×</Operator>
        {term(b)}
        <Operator>=</Operator>
        {term(product, true)}
      </div>
      <div className={row}>
        {term(product)}
        <Operator>×</Operator>
        {term(rate)}
        <Operator>=</Operator>
        {term(total, true)}
      </div>
    </figure>
  );
}

/** The confidence bands of the fleet model, on the share of a district's boats tracked. */
const CONFIDENCE = [
  { band: "low", from: 0, to: 10, color: "var(--tint-1)" },
  { band: "medium", from: 10, to: 30, color: "var(--tint-3)" },
  { band: "high", from: 30, to: 100, color: "var(--tint-5)" },
] as const;

export function ConfidenceScale() {
  const { t } = useT();
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{t("methods-confidence-scale")}</figcaption>
      <div className="flex h-8 overflow-hidden rounded-md">
        {CONFIDENCE.map(({ band, from, to, color }) => (
          <span
            key={band}
            className="flex items-center justify-center gap-1 border-r-2 border-background text-xs font-medium last:border-r-0"
            style={{ width: `${to - from}%`, backgroundColor: color }}
          >
            {band === "low" && <WarningIcon />}
            {t(`text-confidence-${band}`)}
          </span>
        ))}
      </div>
      <div className="relative h-4 text-xs text-muted-foreground tabular-nums">
        {[0, 10, 30, 100].map((pct) => (
          <span
            key={pct}
            className={cn(
              "absolute",
              pct === 0 ? "left-0" : pct === 100 ? "right-0" : "-translate-x-1/2",
            )}
            style={pct > 0 && pct < 100 ? { left: `${pct}%` } : undefined}
          >
            {pct}%
          </span>
        ))}
      </div>
    </figure>
  );
}

// An invented species for the size diagram: maturity at 45 cm, optimum at 55 cm.
const MATURITY_CM = 45;
const OPTIMUM_CM = 55;
// Length classes as the survey forms have them (coasts' length_class()), with made-up shares.
const CLASSES: [number, number, number][] = [
  [10, 15, 0.25],
  [15, 20, 0.5],
  [20, 25, 0.8],
  [25, 30, 0.9],
  [30, 40, 0.8],
  [40, 50, 0.65],
  [50, 60, 0.45],
  [60, 70, 0.25],
  [70, 80, 0.12],
  [80, 90, 0.05],
];
// Wide enough that, at the width of its column, the labels draw at about their set size.
const W = 760;
const TOP = 70;
const BASE = 200;
const x = (cm: number) => 16 + ((cm - 10) / 80) * (W - 32);
const y = (share: number) => BASE - share * (BASE - TOP - 12);
const OPTIMUM_FILL = "color-mix(in oklab, var(--chart-1) 12%, transparent)";

/** A bracket over a span of lengths, with its label above. */
function Bracket({
  from,
  to,
  row,
  label,
}: {
  from: number;
  to: number;
  row: number;
  label: string;
}) {
  const [x0, x1] = [x(from), x(to)];
  return (
    <g className="text-muted-foreground">
      <path
        d={`M${x0},${row + 5} V${row} H${x1} V${row + 5}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
      <text
        x={(x0 + x1) / 2}
        y={row - 5}
        textAnchor="middle"
        className="fill-foreground text-[11px]"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Why a share below maturity is a range: the class that holds the length at
 * maturity has fish on both sides of it. Drawn like the species page's length
 * chart, on an invented species, and labelled as an illustration.
 */
export function SizeDiagram() {
  const { t } = useT();
  const position = (from: number, to: number) =>
    to <= MATURITY_CM ? "below" : from >= MATURITY_CM ? "above" : "spanning";

  return (
    <figure className="flex flex-col gap-3 print:break-inside-avoid">
      <svg
        viewBox={`0 0 ${W} ${BASE + 24}`}
        role="img"
        aria-label={t("methods-size-caption")}
        className="h-auto w-full"
      >
        <rect
          x={x(0.9 * OPTIMUM_CM)}
          y={TOP}
          width={x(1.1 * OPTIMUM_CM) - x(0.9 * OPTIMUM_CM)}
          height={BASE - TOP}
          fill={OPTIMUM_FILL}
        />
        {CLASSES.map(([from, to, share]) => (
          <rect
            key={from}
            x={x(from) + 1}
            y={y(share)}
            width={x(to) - x(from) - 2}
            height={BASE - y(share)}
            rx={1}
            fill={MATURITY_FILL[position(from, to)]}
          />
        ))}
        <line x1={x(10)} x2={x(90)} y1={BASE} y2={BASE} stroke="var(--border)" />
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((cm) => (
          <text
            key={cm}
            x={x(cm)}
            y={BASE + 16}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {cm}
          </text>
        ))}
        <line
          x1={x(MATURITY_CM)}
          x2={x(MATURITY_CM)}
          y1={4}
          y2={BASE}
          stroke="var(--foreground)"
          strokeWidth={1.5}
        />
        <text x={x(MATURITY_CM) + 6} y={14} className="fill-foreground text-[11px]">
          {t("methods-size-maturity", { cm: MATURITY_CM })}
        </text>
        <Bracket from={10} to={50} row={24} label={t("methods-size-most")} />
        <Bracket from={10} to={40} row={52} label={t("methods-size-least")} />
        <Bracket
          from={0.9 * OPTIMUM_CM}
          to={1.1 * OPTIMUM_CM}
          row={52}
          label={t("methods-size-optimum")}
        />
        <Bracket from={1.1 * OPTIMUM_CM} to={90} row={52} label={t("methods-size-large")} />
      </svg>
      <Legend
        items={[
          ...(["below", "spanning", "above"] as const).map((p) => ({
            label: t(`text-${p}-maturity-short`),
            color: MATURITY_FILL[p],
          })),
          { label: t("methods-size-optimum-band"), color: OPTIMUM_FILL },
        ]}
      />
      <figcaption className="text-xs text-muted-foreground">{t("methods-size-caption")}</figcaption>
    </figure>
  );
}

/** A short line with a grey line (or another series) behind it, as in the trend chart and the district panels. */
function Lines({ hollow, behind = "var(--context)" }: { hollow?: boolean; behind?: string }) {
  return (
    <svg viewBox="0 0 56 20" className="h-5 w-14" aria-hidden>
      <polyline points="2,14 18,11 34,13 54,8" fill="none" stroke={behind} strokeWidth={1.5} />
      <polyline
        points="2,10 18,6 34,9 54,4"
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.75}
      />
      {hollow && (
        <circle
          cx={34}
          cy={9}
          r={3}
          fill="var(--background)"
          stroke="var(--chart-1)"
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}

/** The marks the charts use, each drawn as the charts draw it. */
export function ChartKey() {
  const { t, lang } = useT();
  // Keyed by the locale suffix of each mark's explanation, in display order.
  const marks: Record<string, React.ReactNode> = {
    few: <WarningIcon className="size-4" />,
    faded: <span className="block h-2.5 w-14 rounded-r-sm bg-chart-1 opacity-40" />,
    hollow: <Lines hollow />,
    change: <Change pct={5} />,
    approx: <span className="font-semibold tabular-nums">≈{formatApprox(16000, lang)}</span>,
    grey: <Lines />,
    methods: <Lines behind={METHOD_COLOR.artfish} />,
    range: (
      <span className="block w-14">
        <RangeBar least={0.45} most={0.6} />
      </span>
    ),
  };
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(marks).map(([key, mark]) => (
        <div key={key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
          <dt className="flex justify-center">
            {mark}
            <span className="sr-only">{t(`methods-key-${key}-name`)}</span>
          </dt>
          <dd className="text-sm text-muted-foreground">{t(`methods-key-${key}`)}</dd>
        </div>
      ))}
    </dl>
  );
}
