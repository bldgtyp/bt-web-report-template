import type { ProjectConfig } from "./project";

/**
 * Which certification standard the report's display conventions follow.
 *
 * The scraped data always comes from PHPP, so it carries PHI labels and units
 * (treated floor area, PHI compliance check, kWh/m² demands). A report whose
 * recommended pathway is a Phius program shows the same values with Phius
 * terminology instead. The decision is made from project.yaml only, so each
 * project controls it.
 */
export type ReportStandard = "phi" | "phius";

type StandardInputs = Pick<ProjectConfig, "certification_pathways" | "target_standard">;

export function reportStandard(project: StandardInputs | null | undefined): ReportStandard {
  const recommended = project?.certification_pathways?.recommended ?? "";
  if (recommended.startsWith("phius-")) return "phius";
  if (recommended) return "phi";
  return /phius/i.test(project?.target_standard ?? "") ? "phius" : "phi";
}

/** 1 kWh/m² = 0.316998 kBtu/ft² (3.412142 kBtu/kWh ÷ 10.76391 ft²/m²). */
export const KWH_PER_M2_TO_KBTU_PER_FT2 = 3.412142 / 10.76391;

export interface StandardDisplay {
  standard: ReportStandard;
  floorAreaLabel: string;
  floorAreaNote: string;
  floorAreaTooltip: string[];
  thresholdsTitle: string;
  limitLabel: string;
  peakCoolingTitle: string;
  primaryEnergyLabel: string;
  /** Units and conversion factor for the per-area demand rows in the key results table. */
  specificDemandUnits: string;
  specificDemandFactor: number;
}

const PHI_DISPLAY: StandardDisplay = {
  standard: "phi",
  floorAreaLabel: "TFA",
  floorAreaNote: "Treated floor area",
  floorAreaTooltip: [
    "1. For any/all PHI energy model results, interior 'treated' floor areas (TFA) are used for these cases. These areas are based on the European Standard for Residential Floor areas. For more info and details as to which areas are included and which are excluded, see the standard DIN #277.",
    "2. For any/all Phius energy model results, interior conditioned floor areas (iCFA) are used for these cases. These areas are based on the Phius CORE 2021 rules, and more information can be found in the Phius rules document.",
  ],
  thresholdsTitle: "Passive House thresholds",
  limitLabel: "PH-Limit",
  peakCoolingTitle: "Peak Sensible Cooling Load",
  primaryEnergyLabel: "Total Primary Energy",
  specificDemandUnits: "kWh/m2",
  specificDemandFactor: 1,
};

const PHIUS_DISPLAY: StandardDisplay = {
  standard: "phius",
  floorAreaLabel: "iCFA",
  floorAreaNote: "Interior conditioned floor area",
  floorAreaTooltip: [
    "Phius energy model results use the interior conditioned floor area (iCFA): the floor area of conditioned space measured drywall to drywall, including stairs and interior walls, wherever the ceiling height is at least 7 ft, and excluding open-to-below spaces. Phius heating and cooling limits per square foot are based on this area. See the Phius Certification Guidebook for the full rules.",
  ],
  thresholdsTitle: "Phius thresholds",
  limitLabel: "Phius limit",
  peakCoolingTitle: "Peak Cooling Load",
  primaryEnergyLabel: "Net Source Energy",
  specificDemandUnits: "kBtu/ft2-yr",
  specificDemandFactor: KWH_PER_M2_TO_KBTU_PER_FT2,
};

export function standardDisplay(project: StandardInputs | null | undefined): StandardDisplay {
  return reportStandard(project) === "phius" ? PHIUS_DISPLAY : PHI_DISPLAY;
}

/** Relabels a scraped PHPP row label for the report's standard (e.g. "TFA" → "iCFA"). */
export function standardLabel(label: string, display: StandardDisplay): string {
  if (display.standard !== "phius") return label;
  return label.replace(/\bTFA\b/g, display.floorAreaLabel);
}

/** Display conventions for any report data object that may carry the project config. */
export function displayForReport(data: object): StandardDisplay {
  const project = (data as { project?: StandardInputs | null }).project;
  return standardDisplay(project);
}
