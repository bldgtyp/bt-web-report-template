import type { ReportVariant } from "./manifest";

export function variantLabel(variants: ReportVariant[], variantId: string): string {
  return variants.find((variant) => variant.id === variantId)?.name ?? variantId;
}

export function recommendedVariant(variants: ReportVariant[]): ReportVariant | undefined {
  return variants.find((variant) => variant.recommended);
}
