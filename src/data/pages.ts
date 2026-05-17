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

export const reportPageNavItems = [
  reportPages.summary,
  reportPages.energyModel,
  reportPages.envelope,
  reportPages.windows,
  reportPages.mechanical,
].map(({ href, label }) => ({ href, label }));
