export type ManifestStatus = "ok" | "pending" | "error";

export interface ReportVariant {
  id: string;
  name: string;
  order: number;
  recommended?: boolean;
  source_column?: string;
}

export interface ReportManifest {
  status: ManifestStatus;
  project?: {
    slug?: string;
    name?: string;
  };
  generated_at?: string;
  schema_version?: string;
  phpp_version?: string;
  recommended_variant_id?: string;
  variants: ReportVariant[];
}

export function isReportManifest(value: unknown): value is ReportManifest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const manifest = value as Partial<ReportManifest>;
  return (
    (manifest.status === "ok" || manifest.status === "pending" || manifest.status === "error") &&
    Array.isArray(manifest.variants)
  );
}

export function normalizeVariants(manifest: ReportManifest, recommendedVariantId = manifest.recommended_variant_id): ReportVariant[] {
  return manifest.variants
    .map((variant, index) => ({ variant, index }))
    .sort((a, b) => compareVariants(a.variant, b.variant) || a.index - b.index)
    .map(({ variant }) => variant)
    .map((variant) => ({
      ...variant,
      recommended: recommendedVariantId ? variant.id === recommendedVariantId : Boolean(variant.recommended),
    }));
}

function compareVariants(a: ReportVariant, b: ReportVariant): number {
  const aSourceColumn = excelColumnIndex(a.source_column);
  const bSourceColumn = excelColumnIndex(b.source_column);
  if (aSourceColumn !== null && bSourceColumn !== null && aSourceColumn !== bSourceColumn) {
    return aSourceColumn - bSourceColumn;
  }
  return a.order - b.order;
}

function excelColumnIndex(column: string | undefined): number | null {
  if (!column) {
    return null;
  }

  const normalized = column.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) {
    return null;
  }

  let index = 0;
  for (const char of normalized) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
}
