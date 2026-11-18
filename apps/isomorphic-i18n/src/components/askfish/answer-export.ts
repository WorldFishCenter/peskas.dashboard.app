/** Export the entire displayed answer without re-querying Peskas or calling an LLM. */
export type ExportAnswer = {
  headline: string;
  narrative: string;
  statistics: ReadonlyArray<{
    label: string; value: number | null; unit: string | null; detail: unknown;
  }>;
  charts: ReadonlyArray<{
    type: string; title: string; xLabel: string | null; yLabel: string | null;
    sizeLabel?: string | null; sizeUnit?: string | null;
    series: ReadonlyArray<{
      name: string;
      points: ReadonlyArray<{x: string | number; y: number; z?: number | null; label?: string | null}>;
    }>;
  }>;
  caveats: ReadonlyArray<string>;
  sources: ReadonlyArray<{ label: string; records: number; from: string | null; through: string | null }>;
};

const columns = ["record_type", "name", "series", "x", "y", "size", "unit", "detail"] as const;
type Cell = string | number | null | undefined;

function safeCell(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  // Prevent spreadsheet-formula injection in untrusted labels/details.
  const literal = /^[\s]*[=+@-]/.test(cell) ? "'" + cell : cell;
  return '"' + literal.replace(/"/g, '""') + '"';
}

export function answerCsv(answer: ExportAnswer): string {
  const rows: Cell[][] = [columns.slice()];
  for (const stat of answer.statistics) {
    rows.push(["statistic", stat.label, "", "", stat.value, "", stat.unit,
      typeof stat.detail === "string" ? stat.detail : stat.detail == null ? "" : JSON.stringify(stat.detail)]);
  }
  for (const chart of answer.charts) {
    for (const series of chart.series) {
      for (const p of series.points) {
        rows.push(["chart", chart.title, series.name, p.x, p.y, p.z, chart.yLabel,
          [chart.xLabel || "", p.label || "", chart.sizeLabel || "", chart.sizeUnit || ""].filter(Boolean).join(" | ")]);
      }
    }
  }
  for (const source of answer.sources) {
    rows.push(["source", source.label, "", source.from, source.records, "", "records", source.through]);
  }
  for (const caveat of answer.caveats) rows.push(["caveat", "", "", "", "", "", "", caveat]);
  // Excel-compatible BOM; no missing analytical value is imputed as zero.
  return "\uFEFF" + rows.map((row) => row.map(safeCell).join(",")).join("\r\n") + "\r\n";
}

export function answerText(answer: ExportAnswer): string {
  const lines = [answer.headline, answer.narrative, "", "Statistics:"];
  for (const stat of answer.statistics) {
    lines.push(`- ${stat.label}: ${stat.value ?? "not available"}${stat.unit ? " " + stat.unit : ""}` +
      (stat.detail ? ` (${typeof stat.detail === "string" ? stat.detail : JSON.stringify(stat.detail)})` : ""));
  }
  if (answer.caveats.length) lines.push("", "Caveats:", ...answer.caveats.map((s) => "- " + s));
  if (answer.sources.length) lines.push("", "Sources:", ...answer.sources.map((s) =>
    `- ${s.label}: ${s.records} records${s.from ? " from " + s.from : ""}${s.through ? " through " + s.through : ""}`));
  return lines.join("\n");
}

export function downloadAnswerCsv(answer: ExportAnswer): void {
  const blob = new Blob([answerCsv(answer)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = "askfish-answer.csv";
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
