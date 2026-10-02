import { DownloadIcon, InfoIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { Linked } from "@/components/linked-text";
import { useT } from "@/i18n/use-lang";
import { downloadCsv } from "@/lib/csv";
import { trackEvent } from "@/lib/analytics";

/** What a chart shows, how it is calculated and what it can't tell you. */
export type ChartText = { what: string; how?: string; limits?: string };
/** A chart's explanation, or the locale key prefix of its three parts, `<key>-{what,how,limits}`. */
export type ChartInfo = ChartText | string;

/** The explanation behind a chart, opened on click or tap (hover doesn't exist on phones). */
export function InfoPopover({
  id,
  title,
  info,
}: {
  id: string;
  title: React.ReactNode;
  info: ChartInfo;
}) {
  const { t } = useT();
  const text =
    typeof info === "string"
      ? { what: t(`${info}-what`), how: t(`${info}-how`), limits: t(`${info}-limits`) }
      : info;
  const sections = [
    ["text-info-what", text.what],
    ["text-info-how", text.how],
    ["text-info-limits", text.limits],
  ].filter((s): s is [string, string] => !!s[1]);
  return (
    <Popover onOpenChange={(open) => open && trackEvent("chart_info_open", { chart: id })}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("text-info-open")}
            className="print:hidden"
          />
        }
      >
        <InfoIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-medium">{title}</p>
          {sections.map(([key, text]) => (
            <div key={key} className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{t(key)}</p>
              <p className="leading-relaxed">
                <Linked text={text} />
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Card shell shared by the charts: title and description, the explanation
 * popover, a CSV download of the chart's rows, and a `footer` for what only
 * this chart rests on (the page header already says what they all do). `id`
 * names the CSV file and the chart in analytics events.
 */
export function ChartCard({
  id,
  title,
  description,
  action,
  info,
  download,
  footer,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  id: string;
  info?: ChartInfo;
  download?: Record<string, unknown>[];
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const canDownload = !!download?.length;
  return (
    <Card size="sm" className={cn("print:break-inside-avoid", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {(action || info || canDownload) && (
          <CardAction className="flex items-center gap-1">
            {action}
            {info && <InfoPopover id={id} title={title} info={info} />}
            {canDownload && (
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t("text-download-csv")}
                title={t("text-download-csv")}
                className="print:hidden"
                onClick={() => {
                  trackEvent("chart_download", { chart: id });
                  downloadCsv(id, download);
                }}
              >
                <DownloadIcon />
              </Button>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {children}
        {footer && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">{footer}</div>
        )}
      </CardContent>
    </Card>
  );
}
