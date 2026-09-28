import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import { METRIC_KEYS, METRICS } from "@repo/domain/metrics";
import { COVERAGE_MONTHS, CoverageMatrix } from "@/components/dashboard/coverage-matrix";
import {
  ChartKey,
  ConfidenceScale,
  DataFlow,
  EstimateFormula,
  SizeDiagram,
} from "@/components/methods/diagrams";
import { activeCountry } from "@/config/countryConfig";
import { useT } from "@/i18n/use-lang";
import { metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { api } from "@/trpc/react";

// Every string lives in the locales as methods-<section>-…; country facts end in the country code.
const GLOSSARY = [
  "landing",
  "district",
  "trip",
  "cpue",
  "rpue",
  "recorded",
  "estimated",
  "taxon",
  "length-class",
  "maturity",
  "optimum",
  "trophic",
  "vulnerability",
];
/** The page's sections, in order, with their anchors. `#estimates` is linked from the home page. */
const CONTENTS = [
  ["sources", "methods-sources-title"],
  ["coverage", "title-coverage"],
  ["estimates", "methods-estimates-title"],
  ["measures", "methods-measures-title"],
  ["species", "methods-species-title"],
  ["reading", "methods-reading-title"],
  ["glossary", "methods-glossary-title"],
  ["contact", "methods-contact-title"],
] as const;

function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" id={id} className={cn("scroll-mt-16", className)}>
      <CardHeader className="print:break-after-avoid">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

/** Running text: a readable measure, set beside a diagram rather than across the card. */
function Prose({ children }: { children: React.ReactNode }) {
  return <div className="flex max-w-prose flex-col gap-3 leading-relaxed">{children}</div>;
}

/** Prose on the left, its diagram on the right; stacked on a narrow screen. */
function Beside({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {children}
    </div>
  );
}

/** Data and methods: where the numbers come from, how each is made and how to read it. */
export default function AboutPage() {
  const { t, lang } = useT();
  const { hash } = useLocation();
  const { data: coverage } = api.summaries.coverage.useQuery({ months: COVERAGE_MONTHS });
  const { countryCode: code, survey } = activeCountry;
  const updated = coverage?.updatedAt?.toLocaleDateString(lang, { dateStyle: "long" });

  // A link to a section (#estimates) lands on it; React Router doesn't scroll to hashes itself.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  const facts: [string, string][] = [
    ["partner", t(`text-partner-${code}`)],
    ["survey", t(`methods-fact-survey-${code}`)],
    ["recorded", t(`methods-fact-recorded-${code}`)],
    ["weight", t(`methods-fact-weight-${code}`)],
    [
      "prices",
      t(survey.pricedBySpecies ? "methods-prices-body-species" : "methods-prices-body-trip"),
    ],
    ["trackers", t("methods-fact-trackers")],
    ["checks", t("methods-fact-checks")],
    [
      "updates",
      [t(`methods-update-${code}`), updated && t("methods-updated-at", { date: updated })]
        .filter(Boolean)
        .join(" "),
    ],
  ];
  const measures = (estimated: boolean) =>
    METRIC_KEYS.filter((key) => !!METRICS[key].estimated === estimated);

  return (
    <div className="flex flex-col gap-4">
      {/* A row of links rather than a side column: the coverage table needs the full width for 24 months. */}
      <nav
        aria-label={t("text-contents")}
        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm print:hidden"
      >
        <span className="font-semibold">{t("text-contents")}</span>
        {CONTENTS.map(([id, key]) => (
          <a key={id} href={`#${id}`} className="link text-muted-foreground hover:text-foreground">
            {t(key)}
          </a>
        ))}
      </nav>

      <Section id="sources" title={t("methods-sources-title")}>
        <DataFlow />
        <Separator />
        <dl className="grid gap-x-10 gap-y-4 md:grid-cols-2">
          {facts.map(([key, text]) => (
            <div key={key} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-medium">{t(`methods-fact-${key}-term`)}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div id="coverage" className="scroll-mt-16">
        <CoverageMatrix />
      </div>

      <Section id="estimates" title={t("methods-estimates-title")}>
        <Beside>
          <Prose>
            <p>{t("methods-estimates-body")}</p>
            <p>{t("methods-confidence-body")}</p>
          </Prose>
          <div className="flex flex-col gap-6">
            <EstimateFormula />
            <ConfidenceScale />
          </div>
        </Beside>
      </Section>

      <Section id="measures" title={t("methods-measures-title")}>
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%]">{t("text-measure")}</TableHead>
              <TableHead className="w-[24%]">{t("text-info-what")}</TableHead>
              <TableHead className="w-[30%]">{t("text-info-how")}</TableHead>
              <TableHead className="w-[30%]">{t("text-info-limits")}</TableHead>
            </TableRow>
          </TableHeader>
          {[false, true].map((estimated) => (
            <TableBody key={String(estimated)}>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="bg-muted/50 font-medium">
                  {t(estimated ? "title-estimates" : "section-recorded")}
                </TableCell>
              </TableRow>
              {measures(estimated).map((key) => {
                const info = metricInfo(t, key);
                const unit = metricUnit(t, key);
                return (
                  <TableRow key={key}>
                    <TableCell className="align-top whitespace-normal">
                      <div className="font-medium">{metricTitle(t, key)}</div>
                      {unit && <div className="text-xs text-muted-foreground">{unit}</div>}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">{info.what}</TableCell>
                    <TableCell className="align-top whitespace-normal text-muted-foreground">
                      {info.how}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal text-muted-foreground">
                      {info.limits}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          ))}
        </Table>
      </Section>

      <Section id="species" title={t("methods-species-title")}>
        <Beside>
          <Prose>
            <p>{t("methods-species-body")}</p>
            <p>{t("methods-sizes-body")}</p>
            {survey.meanLengths && <p>{t("methods-sizes-body-means")}</p>}
          </Prose>
          <SizeDiagram />
        </Beside>
      </Section>

      <Section id="reading" title={t("methods-reading-title")}>
        <ChartKey />
        <Separator />
        <div className="grid gap-x-10 gap-y-3 leading-relaxed md:grid-cols-2">
          <p>{t("methods-reading-combined")}</p>
          <p>
            {survey.speciesFromSample && `${t("methods-reading-sample")} `}
            {t("methods-reading-limits")}
          </p>
        </div>
      </Section>

      <Section id="glossary" title={t("methods-glossary-title")}>
        <dl className="grid gap-x-10 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
          {GLOSSARY.map((term) => (
            <div key={term}>
              <dt className="text-sm font-medium">{t(`methods-glossary-${term}-term`)}</dt>
              <dd className="text-sm text-muted-foreground">{t(`methods-glossary-${term}`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="contact" title={t("methods-contact-title")}>
        <p className="leading-relaxed">
          {t("methods-contact-body")}{" "}
          <a className="link" href="mailto:peskas.platform@gmail.com">
            peskas.platform@gmail.com
          </a>
          . {t("methods-website-body")}{" "}
          <a className="link" href="https://peskas.org" target="_blank" rel="noreferrer">
            peskas.org
          </a>
          . {t("methods-platform-body")}{" "}
          <a
            className="link"
            href="https://validation.peskas.org/"
            target="_blank"
            rel="noreferrer"
          >
            validation.peskas.org
          </a>
          . {t("methods-api-body")}{" "}
          <a
            className="link"
            href="https://github.com/WorldFishCenter/peskas-api"
            target="_blank"
            rel="noreferrer"
          >
            github.com/WorldFishCenter/peskas-api
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
