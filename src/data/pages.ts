import type { CustomPageConfig } from "./project";

export type CoreReportPageKey = "summary" | "energyModel" | "envelope" | "windows" | "mechanical";

interface ReportPageBase {
  href: string;
  label: string;
  kicker: string;
}

export interface CoreReportPage extends ReportPageBase {
  kind: "core";
  key: CoreReportPageKey;
}

export interface CustomReportPage extends ReportPageBase {
  kind: "custom";
  key: `custom:${string}`;
  slug: string;
}

export type ReportPage = CoreReportPage | CustomReportPage;

export const reportPages = {
  summary: {
    kind: "core",
    key: "summary",
    href: "/",
    label: "Summary",
    kicker: "00",
  },
  energyModel: {
    kind: "core",
    key: "energyModel",
    href: "/energy_model/",
    label: "Energy Model",
    kicker: "01",
  },
  envelope: {
    kind: "core",
    key: "envelope",
    href: "/building_envelope/",
    label: "Envelope",
    kicker: "02",
  },
  windows: {
    kind: "core",
    key: "windows",
    href: "/windows/",
    label: "Windows",
    kicker: "03",
  },
  mechanical: {
    kind: "core",
    key: "mechanical",
    href: "/mechanical/",
    label: "Mechanical",
    kicker: "04",
  },
} as const satisfies Record<CoreReportPageKey, CoreReportPage>;

export const reportPageOrder: readonly CoreReportPage[] = [
  reportPages.summary,
  reportPages.energyModel,
  reportPages.envelope,
  reportPages.windows,
  reportPages.mechanical,
];

const additionalReservedRoutes = ["print", "admin", "assets"];

function routeSegment(href: string): string | undefined {
  const segment = href.replace(/^\//, "").replace(/\/$/, "");
  return segment || undefined;
}

const reservedCustomPageSlugs = new Set([
  ...reportPageOrder.map(({ href }) => routeSegment(href)).filter((slug): slug is string => Boolean(slug)),
  ...additionalReservedRoutes,
]);

export function validateCustomPages(customPages: readonly CustomPageConfig[] = []): void {
  const seen = new Set<string>();
  for (const page of customPages) {
    if (seen.has(page.slug)) {
      throw new Error(`Custom page slug "${page.slug}" is duplicated.`);
    }
    if (reservedCustomPageSlugs.has(page.slug)) {
      throw new Error(`Custom page slug "${page.slug}" collides with a reserved route.`);
    }
    seen.add(page.slug);
  }
}

export function reportPageOrderFor(
  customPages: readonly CustomPageConfig[] | undefined = [],
): readonly ReportPage[] {
  const configuredPages = customPages ?? [];
  validateCustomPages(configuredPages);
  if (configuredPages.length === 0) {
    return reportPageOrder;
  }
  const customReportPages: CustomReportPage[] = configuredPages.map(({ slug, label }, index) => ({
    kind: "custom",
    key: `custom:${slug}`,
    slug,
    href: `/${slug}/`,
    label,
    kicker: String(reportPageOrder.length + index).padStart(2, "0"),
  }));
  return [...reportPageOrder, ...customReportPages];
}
