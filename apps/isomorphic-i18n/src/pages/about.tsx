import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { COVERAGE_MONTHS, CoverageMatrix } from "@/components/dashboard/coverage-matrix";
import { activeCountry } from "@/config/countryConfig";
import { useT } from "@/i18n/use-lang";
import { METRIC_KEYS } from "@repo/domain/metrics";
import { metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { api } from "@/trpc/react";

// Every string lives in the locales as methods-<section>-{title,body,item-*}.
const READING_ITEMS = ["few", "complete", "weighted", "recorded", "map", "indicators"];
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
/** The page's sections, in order, with their anchors: `coverage` first, since "where is the data thin?" comes first. */
const CONTENTS = [
  ["coverage", "title-coverage"],
  ["sources", "methods-sources-title"],
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
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" id={id} className="scroll-mt-16">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex max-w-3xl flex-col gap-3 leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

/** Data and methods: where the numbers come from, how each is made and how to read it. */
export default function AboutPage() {
  const { t, lang } = useT();
  const { hash } = useLocation();
  const { data: coverage } = api.summaries.coverage.useQuery({ months: COVERAGE_MONTHS });
  const { countryCode: code, survey } = activeCountry;

  // A link to a section (#estimates) lands on it; React Router doesn't scroll to hashes itself.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

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

      <div className="flex min-w-0 flex-col gap-4">
        <div id="coverage" className="scroll-mt-16">
          <CoverageMatrix />
        </div>

        <Section id="sources" title={t("methods-sources-title")}>
          <p>{t(`methods-sources-body-${code}`)}</p>
          <p>
            {t(`methods-update-${code}`)}
            {coverage?.updatedAt &&
              ` ${t("methods-updated-at", { date: coverage.updatedAt.toLocaleDateString(lang, { dateStyle: "long" }) })}`}
          </p>
        </Section>

        <Section id="estimates" title={t("methods-estimates-title")}>
          <p>{t("methods-estimates-body")}</p>
          <p>{t("methods-confidence-body")}</p>
        </Section>

        <Section id="measures" title={t("methods-measures-title")}>
          <Accordion multiple>
            {METRIC_KEYS.map((key) => {
              const info = metricInfo(t, key);
              const unit = metricUnit(t, key);
              return (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger>
                    <span>
                      {metricTitle(t, key)}
                      {unit && <span className="font-normal text-muted-foreground"> ({unit})</span>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <dl className="flex flex-col gap-2 text-muted-foreground">
                      <dd>{info.what}</dd>
                      <dd>
                        <strong className="font-medium text-foreground">
                          {t("text-info-how")}:
                        </strong>{" "}
                        {info.how}
                      </dd>
                      <dd>
                        <strong className="font-medium text-foreground">
                          {t("text-info-limits")}:
                        </strong>{" "}
                        {info.limits}
                      </dd>
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </Section>

        <Section id="species" title={t("methods-species-title")}>
          <p>{t("methods-species-body")}</p>
          <p>{t(survey.meanLengths ? "methods-sizes-body-means" : "methods-sizes-body")}</p>
          <p>
            {t(survey.pricedBySpecies ? "methods-prices-body-species" : "methods-prices-body-trip")}
          </p>
        </Section>

        <Section id="reading" title={t("methods-reading-title")}>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {READING_ITEMS.map((item) => (
              <li key={item}>{t(`methods-reading-item-${item}`)}</li>
            ))}
            {survey.speciesFromSample && <li>{t("methods-reading-item-sample")}</li>}
          </ul>
        </Section>

        <Section id="glossary" title={t("methods-glossary-title")}>
          <dl className="grid gap-3 md:grid-cols-2">
            {GLOSSARY.map((term) => (
              <div key={term}>
                <dt className="font-medium">{t(`methods-glossary-${term}-term`)}</dt>
                <dd className="text-muted-foreground">{t(`methods-glossary-${term}`)}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="contact" title={t("methods-contact-title")}>
          <p>
            {t("methods-contact-body")}{" "}
            <a className="link" href="mailto:peskas.platform@gmail.com">
              peskas.platform@gmail.com
            </a>
            . {t("methods-api-body")}{" "}
            <a className="link" href="https://api.peskas.org/docs" target="_blank" rel="noreferrer">
              api.peskas.org
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
