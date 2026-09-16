import type { ImageMetadata } from "astro";

import logoEnerphit from "../assets/certifications/logo-enerphit.png";
import logoPhiLeb from "../assets/certifications/logo-phi-leb.png";
import logoPhiNew from "../assets/certifications/logo-phi-new.png";
import logoPhiusCore from "../assets/certifications/logo-phius-core.png";
import logoPhiusZero from "../assets/certifications/logo-phius-zero.png";
import catalogJson from "./certification-pathways.json";
import {
  DEFAULT_CERTIFICATION_PATHWAY_IDS,
  resolveCertificationPathwaySelection,
} from "./certification-pathway-selection.mjs";
import type { ProjectConfig } from "./project";
import { resolveVar } from "./resolve-var";

export const certificationPathwayLogos = {
  "phi-new": logoPhiNew,
  "phi-leb": logoPhiLeb,
  enerphit: logoEnerphit,
  "phius-core": logoPhiusCore,
  "phius-zero": logoPhiusZero,
} satisfies Record<string, ImageMetadata>;

export type CertificationPathwayLogoKey = keyof typeof certificationPathwayLogos;

interface CertificationPathwayRowBase {
  label: string;
  highlight?: true;
}

export interface LiteralCertificationPathwayRow extends CertificationPathwayRowBase {
  value: string;
}

export interface BoundCertificationPathwayRow extends CertificationPathwayRowBase {
  key: string;
  unit?: string;
  fallback: string;
}

export type CertificationPathwayRow = LiteralCertificationPathwayRow | BoundCertificationPathwayRow;

export interface CertificationPathwaySection {
  heading: string;
  rows: CertificationPathwayRow[];
}

export interface CertificationPathwayCatalogEntry {
  id: string;
  title: string;
  markLabel: string;
  logo: CertificationPathwayLogoKey;
  sections: CertificationPathwaySection[];
  note: string;
}

export interface ResolvedCertificationPathway extends CertificationPathwayCatalogEntry {
  logoImage: ImageMetadata;
  recommended: boolean;
}

export const certificationPathways = catalogJson as CertificationPathwayCatalogEntry[];

export { DEFAULT_CERTIFICATION_PATHWAY_IDS };

const warnedMissingRowKeys = new Set<string>();

export function resolveCertificationPathways(project: ProjectConfig): ResolvedCertificationPathway[] {
  const byId = new Map(certificationPathways.map((entry) => [entry.id, entry]));
  const { selectedIds, recommended } = resolveCertificationPathwaySelection(
    project.certification_pathways,
    certificationPathways.map(({ id }) => id),
    DEFAULT_CERTIFICATION_PATHWAY_IDS,
  );

  return selectedIds.map((id) => {
    const entry = byId.get(id);
    if (!entry) {
      throw new Error(`Certification pathway catalog entry "${id}" could not be resolved.`);
    }
    return {
      ...entry,
      logoImage: certificationPathwayLogos[entry.logo],
      recommended: id === recommended,
    };
  });
}

export function resolveCertificationPathwayRowValue(
  project: ProjectConfig,
  row: CertificationPathwayRow,
): string {
  if ("value" in row) {
    return row.value;
  }

  const result = resolveVar(project, row.key);
  if (result.found) {
    return row.unit ? `${result.value} ${row.unit}` : result.value;
  }

  if (!warnedMissingRowKeys.has(row.key)) {
    warnedMissingRowKeys.add(row.key);
    console.warn(
      `[Certification pathway] missing key '${row.key}' (${result.reason}). Rendering fallback. Add the field to project.yaml or fix the catalog reference.`,
    );
  }
  return row.fallback;
}
