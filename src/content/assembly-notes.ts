const DOUBLE_QUOTE_ENTITIES = /&quot;|&#34;|&#x22;/gi;
const SMART_DOUBLE_QUOTES = /[\u201c\u201d\u201e\u201f\u2033]/g;
const SMART_SINGLE_QUOTES = /[\u2018\u2019\u201a\u201b]/g;
const HORIZONTAL_WHITESPACE = /[\t\f\v\u00a0 ]+/g;

export function normalizeAssemblyNote(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(DOUBLE_QUOTE_ENTITIES, '"')
    .replace(SMART_DOUBLE_QUOTES, '"')
    .replace(SMART_SINGLE_QUOTES, "'")
    .replace(/\r\n?/g, "\n")
    .replace(HORIZONTAL_WHITESPACE, " ")
    .replace(/\n+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

export function normalizeAssemblyNotes(value: unknown): string[] {
  const rawNotes = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

  return rawNotes.map(normalizeAssemblyNote).filter((note) => note.length > 0);
}
