import { activeCountry } from "@/config/countryConfig";

const cell = (value: unknown) => {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Save rows as `peskas-<country>-<name>.csv`; the columns are every key any row has. */
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const csv = [
    keys.map(cell).join(","),
    ...rows.map((row) => keys.map((k) => cell(row[k])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `peskas-${activeCountry.countryName.toLowerCase()}-${name}.csv`,
  });
  link.click();
  URL.revokeObjectURL(url);
}
