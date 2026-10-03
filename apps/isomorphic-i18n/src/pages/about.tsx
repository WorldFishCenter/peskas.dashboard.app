import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  BookOpenTextIcon,
  CalculatorIcon,
  CalendarRangeIcon,
  ChartLineIcon,
  DatabaseIcon,
  FishIcon,
  InfoIcon,
  MailIcon,
  RulerIcon,
  ScaleIcon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
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
import {
  methodOf,
  METHODS,
  METRIC_KEYS,
  METRICS,
  type Method,
  type MetricKey,
} from "@repo/domain/metrics";
import { COVERAGE_MONTHS, CoverageMatrix } from "@/components/dashboard/coverage-matrix";
import {
  ChartKey,
  ConfidenceScale,
  DataFlow,
  EstimateFormula,
  SizeDiagram,
} from "@/components/methods/diagrams";
import { ARTFISH_TOOLKIT, ExternalLink, Linked } from "@/components/linked-text";
import { activeCountry } from "@/config/countryConfig";
import { useT } from "@/i18n/use-lang";
import { METHOD_COLOR, metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
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
  "tracker-method",
  "artfish-method",
  "taxon",
  "length-class",
  "maturity",
  "optimum",
  "trophic",
  "vulnerability",
];
/** Where the contact section sends each reader, in order: its locale keys are methods-contact-<key>(-term). */
const CONTACTS = [
  ["questions", "mailto:peskas.platform@gmail.com", "peskas.platform@gmail.com"],
  ["platform", "https://validation.peskas.org/", "validation.peskas.org"],
  ["api", "https://github.com/WorldFishCenter/peskas-api", "github.com/WorldFishCenter/peskas-api"],
  ["peskas", "https://peskas.org", "peskas.org"],
] as const;
/**
 * The page's sections, in order: anchor, title key and the icon that marks it
 * in the contents and on its card. `#estimates` is linked from the home page.
 */
const CONTENTS = {
  sources: ["methods-sources-title", DatabaseIcon],
  coverage: ["title-coverage", CalendarRangeIcon],
  estimates: ["methods-estimates-title", CalculatorIcon],
  measures: ["methods-measures-title", RulerIcon],
  species: ["methods-species-title", FishIcon],
  reading: ["methods-reading-title", ChartLineIcon],
  glossary: ["methods-glossary-title", BookOpenTextIcon],
  contact: ["methods-contact-title", MailIcon],
} satisfies Record<string, [string, LucideIcon]>;

/** A section of the page as a card: its icon and title, what it covers (`methods-<id>-intro`), its content. */
function Section({ id, children }: { id: keyof typeof CONTENTS; children: React.ReactNode }) {
  const { t } = useT();
  const [title, Icon] = CONTENTS[id];
  return (
    <Card size="sm" id={id} className="scroll-mt-16">
      <CardHeader className="border-b print:break-after-avoid">
        <CardTitle className="flex items-center gap-2">
          <Icon aria-hidden className="size-4 text-primary" />
          {t(title)}
        </CardTitle>
        <CardDescription>{t(`methods-${id}-intro`)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

/** One estimation method as its own card, marked by its line colour in the charts. */
function MethodCard({ method, children }: { method: Method; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <Card size="sm" className="border-t-4" style={{ borderTopColor: METHOD_COLOR[method] }}>
      <CardHeader>
        <CardTitle>{t(`text-method-${method}`)}</CardTitle>
        <CardDescription>{t(`methods-${method}-summary`)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
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
  // The measures table's groups: recorded, then each method's estimates.
  const groups = [
    ["recorded", t("section-recorded")],
    ...METHODS.map((m) => [m, `${t("title-estimates")}: ${t(`text-method-${m}`)}`] as const),
  ];
  const groupOf = (key: MetricKey) => (METRICS[key].estimated ? methodOf(key) : "recorded");

  return (
    <div className="flex flex-col gap-6">
      {/* The contents above the page rather than beside it: the coverage table needs the full width for 24 months. */}
      <Card size="sm" className="print:hidden">
        <CardHeader>
          <CardTitle>{t("text-contents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <nav aria-label={t("text-contents")}>
            <ul className="flex flex-wrap gap-2">
              {Object.entries(CONTENTS).map(([id, [key, Icon]]) => (
                <li key={id}>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={`#${id}`} />}
                  >
                    <Icon data-icon="inline-start" />
                    {t(key)}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        </CardContent>
      </Card>

      <Section id="sources">
        <DataFlow />
        <Separator />
        <dl className="grid gap-x-10 gap-y-4 md:grid-cols-2">
          {facts.map(([key, text]) => (
            <div key={key} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-medium">{t(`methods-fact-${key}-term`)}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                <Linked text={text} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <div id="coverage" className="scroll-mt-16">
        <CoverageMatrix />
      </div>

      <Section id="estimates">
        <p className="max-w-prose leading-relaxed">{t("methods-estimates-body")}</p>
        <div className="grid items-start gap-4 lg:grid-cols-2 print:grid-cols-2">
          <MethodCard method="tracker">
            <EstimateFormula method="tracker" />
            <Prose>
              <p>{t("methods-tracker-body")}</p>
              <p>{t("methods-confidence-body")}</p>
            </Prose>
            <ConfidenceScale />
          </MethodCard>
          <MethodCard method="artfish">
            <EstimateFormula method="artfish" />
            <Prose>
              {/* The reference below links the toolkit: the body names it without a second link. */}
              <p>{t("methods-artfish-body")}</p>
              <p>{t(`methods-artfish-days-${code}`)}</p>
              <p>{t("methods-artfish-precision")}</p>
              <p className="text-sm text-muted-foreground">
                {t("methods-artfish-reference")}{" "}
                <ExternalLink href={ARTFISH_TOOLKIT}>
                  {t("methods-artfish-reference-link")}
                </ExternalLink>
              </p>
            </Prose>
          </MethodCard>
        </div>
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {(
            [
              ["differ", InfoIcon],
              ["totals", ScaleIcon],
            ] as const
          ).map(([key, Icon]) => (
            <Alert key={key}>
              <Icon />
              <AlertTitle>{t(`methods-compare-${key}-title`)}</AlertTitle>
              <AlertDescription>{t(`methods-compare-${key}`)}</AlertDescription>
            </Alert>
          ))}
        </div>
      </Section>

      <Section id="measures">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%]">{t("text-measure")}</TableHead>
              <TableHead className="w-[24%]">{t("text-info-what")}</TableHead>
              <TableHead className="w-[30%]">{t("text-info-how")}</TableHead>
              <TableHead className="w-[30%]">{t("text-info-limits")}</TableHead>
            </TableRow>
          </TableHeader>
          {groups.map(([group, title]) => (
            <TableBody key={group}>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="bg-muted/50 font-medium">
                  {title}
                </TableCell>
              </TableRow>
              {METRIC_KEYS.filter((key) => groupOf(key) === group).map((key) => {
                const info = metricInfo(t, key);
                const unit = metricUnit(t, key);
                return (
                  <TableRow key={key}>
                    <TableCell className="align-top whitespace-normal">
                      <div className="font-medium">{metricTitle(t, key)}</div>
                      {unit && <div className="text-xs text-muted-foreground">{unit}</div>}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      <Linked text={info.what} />
                    </TableCell>
                    <TableCell className="align-top whitespace-normal text-muted-foreground">
                      <Linked text={info.how} />
                    </TableCell>
                    <TableCell className="align-top whitespace-normal text-muted-foreground">
                      <Linked text={info.limits} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          ))}
        </Table>
      </Section>

      <Section id="species">
        <Beside>
          <Prose>
            <p>
              <Linked text={t("methods-species-body")} />
            </p>
            <p>{t("methods-sizes-body")}</p>
            {survey.meanLengths && <p>{t("methods-sizes-body-means")}</p>}
          </Prose>
          <SizeDiagram />
        </Beside>
      </Section>

      <Section id="reading">
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

      <Section id="glossary">
        <dl className="grid gap-x-10 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
          {GLOSSARY.map((term) => (
            <div key={term}>
              <dt className="text-sm font-medium">{t(`methods-glossary-${term}-term`)}</dt>
              <dd className="text-sm text-muted-foreground">
                <Linked text={t(`methods-glossary-${term}`)} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="contact">
        <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          {CONTACTS.map(([key, href, label]) => (
            <div key={key} className="flex flex-col gap-1 text-sm">
              <dt className="font-medium">{t(`methods-contact-${key}-term`)}</dt>
              <dd className="leading-relaxed text-muted-foreground">
                <Linked text={t(`methods-contact-${key}`)} />
              </dd>
              <dd>
                <ExternalLink href={href}>{label}</ExternalLink>
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
