export interface PrintableEmbedProps {
  /** Stable author-facing identity used in PDF diagnostics. */
  id: string;
  /** Accessible name for both the interactive group and static print image. */
  title: string;
  /** Root-relative URL for the project-owned static print asset. */
  printSrc: string;
  /** Intrinsic print-asset width, in pixels. */
  width: number;
  /** Intrinsic print-asset height, in pixels. */
  height: number;
}

export function validatePrintableEmbedProps(props: unknown): PrintableEmbedProps {
  if (!isRecord(props)) {
    throw new Error("PrintableEmbed props must be an object.");
  }

  const id = requiredString(props.id, "id");
  const title = requiredString(props.title, "title");
  const printSrc = requiredString(props.printSrc, "printSrc");

  if (!printSrc.startsWith("/") || printSrc.startsWith("//")) {
    throw new Error(
      `PrintableEmbed "${id}" printSrc must be a root-relative public asset URL; received "${printSrc}".`,
    );
  }

  const width = positiveInteger(props.width, "width", id);
  const height = positiveInteger(props.height, "height", id);

  return { id, title, printSrc, width, height };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`PrintableEmbed requires a non-empty ${name}.`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, name: string, id: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`PrintableEmbed "${id}" ${name} must be a positive integer; received ${String(value)}.`);
  }
  return value;
}
