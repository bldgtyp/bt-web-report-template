export interface ReportPage {
  key: "summary" | "energyModel" | "envelope" | "windows" | "mechanical";
  href: string;
  label: string;
  kicker: string;
}

export const reportPages = {
  summary: {
    key: "summary",
    href: "/",
    label: "Summary",
    kicker: "00",
  },
  energyModel: {
    key: "energyModel",
    href: "/energy_model/",
    label: "Energy Model",
    kicker: "01",
  },
  envelope: {
    key: "envelope",
    href: "/building_envelope/",
    label: "Envelope",
    kicker: "02",
  },
  windows: {
    key: "windows",
    href: "/windows/",
    label: "Windows",
    kicker: "03",
  },
  mechanical: {
    key: "mechanical",
    href: "/mechanical/",
    label: "Mechanical",
    kicker: "04",
  },
} as const satisfies Record<string, ReportPage>;

/**
 * The report's page order — nav order and print/PDF order are the same order.
 * Everything that needs it derives from this array, so there is one place to
 * reorder pages.
 */
export const reportPageOrder: ReportPage[] = [
  reportPages.summary,
  reportPages.energyModel,
  reportPages.envelope,
  reportPages.windows,
  reportPages.mechanical,
];

export const reportPageNavItems = reportPageOrder.map(({ href, label }) => ({ href, label }));
