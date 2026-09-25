import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { useT } from "@/i18n/use-lang";

type Subsection = { key: string; items?: string[] };
type Section = { key: string; subsections?: Subsection[]; items?: string[]; conclusion?: boolean };

// Every string lives in the locales as about-<section>-{title,body,item-*}.
const SECTIONS: Section[] = [
  { key: "purpose" },
  {
    key: "data",
    subsections: [
      { key: "catch" },
      { key: "economic", items: ["revenue", "costs", "market", "indicators"] },
      { key: "community", items: ["performance", "patterns", "strategies", "compare"] },
      { key: "sustainability", items: ["thresholds", "trends", "ecosystem", "practices"] },
    ],
  },
  { key: "implementation" },
  { key: "knowledge" },
  { key: "vision", items: ["decisions", "economy", "ecosystems", "transparency", "capacity"], conclusion: true },
];

function Items({ prefix, items }: { prefix: string; items?: string[] }) {
  const { t } = useT();
  if (!items) return null;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{t(`${prefix}-item-${item}`)}</li>
      ))}
    </ul>
  );
}

export default function AboutPage() {
  const { t } = useT();

  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader>
        <CardTitle>{t("about-title")}</CardTitle>
        <CardDescription>{t("about-intro")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 leading-relaxed">
        {SECTIONS.map((section) => (
          <section key={section.key} className="flex flex-col gap-3">
            <Separator />
            <h2 className="text-lg font-semibold">{t(`about-${section.key}-title`)}</h2>
            {section.subsections ? (
              <div className="grid gap-6 md:grid-cols-2">
                {section.subsections.map((sub) => {
                  const prefix = `about-${section.key}-${sub.key}`;
                  return (
                    <div key={sub.key} className="flex flex-col gap-2">
                      <h3 className="font-medium">{t(`${prefix}-title`)}</h3>
                      <p className="text-muted-foreground">{t(`${prefix}-body`)}</p>
                      <Items prefix={prefix} items={sub.items} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">{t(`about-${section.key}-body`)}</p>
            )}
            <Items prefix={`about-${section.key}`} items={section.items} />
            {section.conclusion && <p className="text-muted-foreground">{t(`about-${section.key}-conclusion`)}</p>}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
