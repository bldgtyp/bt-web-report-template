import type { CsvCell, CsvRow } from "./csv";
import type { ReportVariant } from "./manifest";

const VARIANT_COLOR_COUNT = 8;

export interface EndUseGroup {
  id: string;
  label: string;
  color: string;
}

const SITE_ENERGY_GROUPS = [
  { id: "heating", label: "Heating", color: "var(--btwr-chart-heating)" },
  { id: "cooling", label: "Cooling", color: "var(--btwr-chart-cooling)" },
  { id: "dhw", label: "DHW", color: "var(--btwr-chart-dhw)" },
  { id: "lighting", label: "Elec Lights", color: "var(--btwr-chart-lighting)" },
  { id: "equipment", label: "Elec Equip", color: "var(--btwr-chart-equipment)" },
  { id: "pumps_fans", label: "Pumps / Fans", color: "var(--btwr-chart-pumps)" },
] satisfies EndUseGroup[];

const [HEATING_GROUP, COOLING_GROUP, DHW_GROUP, LIGHTING_GROUP, EQUIPMENT_GROUP, PUMPS_FANS_GROUP] =
  SITE_ENERGY_GROUPS;

const SITE_ENERGY_GROUP_BY_END_USE = new Map<string, EndUseGroup>([
  ["heating", HEATING_GROUP],
  ["cooling", COOLING_GROUP],
  ["dhw", DHW_GROUP],
  ["domestic_hot_water", DHW_GROUP],
  ["hot_water", DHW_GROUP],
  ["phi_lighting", LIGHTING_GROUP],
  ["phius_int_lighting", LIGHTING_GROUP],
  ["phius_ext_lighting", LIGHTING_GROUP],
  ["lighting", LIGHTING_GROUP],
  ["phi_consumer_elec", EQUIPMENT_GROUP],
  ["phi_small_appliances", EQUIPMENT_GROUP],
  ["phius_mel", EQUIPMENT_GROUP],
  ["dishwashing", EQUIPMENT_GROUP],
  ["clothes_washing", EQUIPMENT_GROUP],
  ["clothes_drying", EQUIPMENT_GROUP],
  ["refrigerator", EQUIPMENT_GROUP],
  ["cooking", EQUIPMENT_GROUP],
  ["equipment", EQUIPMENT_GROUP],
  ["electric_equipment", EQUIPMENT_GROUP],
  ["electric_vehicles", EQUIPMENT_GROUP],
  ["ev", EQUIPMENT_GROUP],
  ["aux_elec", PUMPS_FANS_GROUP],
  ["pumps", PUMPS_FANS_GROUP],
  ["fans", PUMPS_FANS_GROUP],
  ["pumps_fans", PUMPS_FANS_GROUP],
  ["misc_pumps_fans", PUMPS_FANS_GROUP],
]);

const END_USE_CHART_COLORS = new Map<string, string>([
  ["heating", "var(--btwr-chart-heating)"],
  ["cooling", "var(--btwr-chart-cooling)"],
  ["dhw", "var(--btwr-chart-dhw)"],
  ["domestic_hot_water", "var(--btwr-chart-dhw)"],
  ["phi_lighting", "var(--btwr-chart-lighting)"],
  ["phius_int_lighting", "var(--btwr-chart-lighting)"],
  ["phius_ext_lighting", "var(--btwr-chart-lighting)"],
  ["lighting", "var(--btwr-chart-lighting)"],
  ["phi_consumer_elec", "var(--btwr-chart-equipment)"],
  ["phi_small_appliances", "var(--btwr-chart-equipment)"],
  ["phius_mel", "var(--btwr-chart-equipment)"],
  ["dishwashing", "var(--btwr-chart-equipment)"],
  ["clothes_washing", "var(--btwr-chart-equipment)"],
  ["clothes_drying", "var(--btwr-chart-equipment)"],
  ["refrigerator", "var(--btwr-chart-equipment)"],
  ["cooking", "var(--btwr-chart-equipment)"],
  ["equipment", "var(--btwr-chart-equipment)"],
  ["aux_elec", "var(--btwr-chart-pumps)"],
  ["pumps", "var(--btwr-chart-pumps)"],
  ["fans", "var(--btwr-chart-pumps)"],
  ["pumps_fans", "var(--btwr-chart-pumps)"],
  ["misc_pumps_fans", "var(--btwr-chart-pumps)"],
  ["solar_pv", "var(--btwr-chart-renewable)"],
  ["pv", "var(--btwr-chart-renewable)"],
  ["renewable", "var(--btwr-chart-renewable)"],
  ["renewable_energy", "var(--btwr-chart-renewable)"],
]);

function chartColorKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function cellText(row: CsvRow, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function cellNumber(row: CsvRow, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isPresent(value: CsvCell): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function labelize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bPhius\b/i, "Phius")
    .replace(/\bPer\b/g, "PER")
    .replace(/\bCo2e\b/g, "CO2e")
    .replace(/\bDhw\b/g, "DHW")
    .replace(/\bTfa\b/g, "TFA");
}

export function variantName(variants: ReportVariant[], variantId: string): string {
  return variants.find((variant) => variant.id === variantId)?.name ?? labelize(variantId);
}

export function variantColor(index: number): string {
  return `var(--btwr-chart-variant-${(index % VARIANT_COLOR_COUNT) + 1})`;
}

export function variantColorMap(variants: ReportVariant[]): Map<string, string> {
  return new Map(variants.map((variant, index) => [variant.id, variantColor(index)]));
}

export function endUseColor(endUse: string): string {
  return END_USE_CHART_COLORS.get(chartColorKey(endUse)) ?? "var(--btwr-chart-other)";
}

export function siteEnergyGroups(): EndUseGroup[] {
  return [...SITE_ENERGY_GROUPS];
}

export function siteEnergyGroupForEndUse(endUse: string): EndUseGroup | null {
  if (chartColorKey(endUse) === "solar_pv") {
    return null;
  }
  return SITE_ENERGY_GROUP_BY_END_USE.get(chartColorKey(endUse)) ?? {
    id: "equipment",
    label: "Elec Equip",
    color: "var(--btwr-chart-equipment)",
  };
}

export function sortByVariantOrder<T extends { variantId: string }>(items: T[], variants: ReportVariant[]): T[] {
  const order = new Map(variants.map((variant, index) => [variant.id, index]));
  return [...items].sort((a, b) => (order.get(a.variantId) ?? 999) - (order.get(b.variantId) ?? 999));
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function formatValue(value: number | null, units?: string): string {
  if (value === null) {
    return "—";
  }

  const absolute = Math.abs(value);
  const maximumFractionDigits = absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);

  return units ? `${formatted} ${units}` : formatted;
}

export function formatCell(value: CsvCell, units?: string): string {
  if (typeof value === "number") {
    return formatValue(value, units);
  }
  if (!isPresent(value)) {
    return "—";
  }
  return String(value);
}
