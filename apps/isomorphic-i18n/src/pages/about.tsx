import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { COVERAGE_MONTHS, CoverageMatrix } from "@/components/dashboard/coverage-matrix";
import { activeCountry } from "@/config/countryConfig";
import { useT } from "@/i18n/use-lang";
import { METRIC_KEYS } from "@repo/domain/metrics";
import { metricInfo, metricTitle, metricUnit } from "@/lib/dashboard/metrics";
import { api } from "@/trpc/react";

// Every string lives in the locales as methods-<section>-{title,body,item-*}.
const READING_ITEMS = ["few", "complete", "weighted", "recorded", "map", "indicators"];
const GLOSSARY = ["landing", "district", "trip", "cpue", "rpue", "recorded", "estimated", "taxon", "length-class", "maturity", "optimum", "trophic", "vulnerability"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex max-w-4xl flex-col gap-3 leading-relaxed">{children}</CardContent>
    </Card>
  );
}

/** Data and methods: where the numbers come from, how each is made and how to read it. */
export default function AboutPage() {
  const { t, lang } = useT();
  const { data: coverage } = api.summaries.coverage.useQuery({ months: COVERAGE_MONTHS });
  const { countryCode: code, survey } = activeCountry;

  return (
    <>
      <Section title={t("methods-sources-title")}>
        <p>{t(`methods-sources-body-${code}`)}</p>
        <p>
          {t(`methods-update-${code}`)}
          {coverage?.updatedAt &&
            ` ${t("methods-updated-at", { date: coverage.updatedAt.toLocaleDateString(lang, { dateStyle: "long" }) })}`}
        </p>
      </Section>

      <Section title={t("methods-estimates-title")}>
        <p>{t("methods-estimates-body")}</p>
        <p>{t("methods-confidence-body")}</p>
      </Section>

      <Section title={t("methods-measures-title")}>
        <dl className="flex flex-col gap-4">
          {METRIC_KEYS.map((key) => {
            const info = metricInfo(t, key);
            const unit = metricUnit(t, key);
            return (
              <div key={key} className="flex flex-col gap-1">
                <dt className="font-medium">
                  {metricTitle(t, key)}
                  {unit && <span className="font-normal text-muted-foreground"> ({unit})</span>}
                </dt>
                <dd className="text-muted-foreground">{info.what}</dd>
                <dd className="text-muted-foreground">
                  <strong className="font-medium text-foreground">{t("text-info-how")}:</strong> {info.how}
                </dd>
                <dd className="text-muted-foreground">
                  <strong className="font-medium text-foreground">{t("text-info-limits")}:</strong> {info.limits}
                </dd>
              </div>
            );
          })}
        </dl>
      </Section>

      <Section title={t("methods-species-title")}>
        <p>{t("methods-species-body")}</p>
        <p>{t(survey.meanLengths ? "methods-sizes-body-means" : "methods-sizes-body")}</p>
        <p>{t(survey.pricedBySpecies ? "methods-prices-body-species" : "methods-prices-body-trip")}</p>
      </Section>

      <Section title={t("methods-reading-title")}>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {READING_ITEMS.map((item) => (
            <li key={item}>{t(`methods-reading-item-${item}`)}</li>
          ))}
          {survey.speciesFromSample && <li>{t("methods-reading-item-sample")}</li>}
        </ul>
      </Section>

      <CoverageMatrix />

      <Section title={t("methods-glossary-title")}>
        <dl className="grid gap-3 md:grid-cols-2">
          {GLOSSARY.map((term) => (
            <div key={term}>
              <dt className="font-medium">{t(`methods-glossary-${term}-term`)}</dt>
              <dd className="text-muted-foreground">{t(`methods-glossary-${term}`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t("methods-contact-title")}>
        <p>
          {t("methods-contact-body")}{" "}
          <a className="text-primary underline-offset-4 hover:underline" href="mailto:peskas.platform@gmail.com">
            peskas.platform@gmail.com
          </a>
          . {t("methods-api-body")}{" "}
          <a className="text-primary underline-offset-4 hover:underline" href="https://api.peskas.org/docs" target="_blank" rel="noreferrer">
            api.peskas.org
          </a>
          .
        </p>
      </Section>
    </>
  );
}
