export interface CertificationPathwaySelectionConfig {
  show: readonly string[];
  recommended?: string | null;
}

export interface ResolvedCertificationPathwaySelection {
  selectedIds: string[];
  recommended?: string;
}

export const DEFAULT_CERTIFICATION_PATHWAY_IDS: readonly [
  "phi-classic",
  "phi-leb",
  "phius-core-2024",
  "phius-zero-2024",
];

export function resolveCertificationPathwaySelection(
  config: CertificationPathwaySelectionConfig | null | undefined,
  catalogIds: readonly string[],
  defaultIds: readonly string[],
): ResolvedCertificationPathwaySelection;
