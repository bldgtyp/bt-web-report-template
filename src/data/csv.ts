import { csvParse } from "d3-dsv";

export type CsvCell = string | number | null;
export type CsvRow = Record<string, CsvCell>;

const NUMERIC_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export function coerceCsvCell(value: string | undefined): CsvCell {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  if (NUMERIC_PATTERN.test(trimmed)) {
    return Number(trimmed);
  }

  return value;
}

export function parseCsv(text: string): CsvRow[] {
  return [...csvParse(text, (row) => {
    const parsed: CsvRow = {};
    for (const [key, value] of Object.entries(row)) {
      parsed[key] = coerceCsvCell(value);
    }
    return parsed;
  })];
}
