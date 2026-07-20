// The report's five page groups, in print order.
//
// One glob per content directory lives here and nowhere else, so the web
// pages, print.astro, and PrintToc.astro all compose from the same lists and
// cannot drift.
//
// Each accessor is a function rather than a module-level constant so that
// `loadSections`'s validation (empty directory, missing or duplicate kicker)
// runs per caller and names the page that actually asked for it. Note this
// does not isolate MDX parse errors: the globs below are eager, so importing
// any export from this module loads all four directories.

import Summary, { frontmatter as summaryFrontmatter } from "../../content/summary.mdx";
import { reportPageOrder, type ReportPage } from "./pages";
import { loadSections, type SectionEntry, type SectionFrontmatter, type SectionModule } from "./sections";

// Astro types MDX frontmatter as Record<string, any>, so the static Summary
// import needs an explicit narrowing; the globbed sections get theirs from the
// SectionModule type parameter below.
const summary = summaryFrontmatter as SectionFrontmatter;

export interface PageSections {
  page: ReportPage;
  sections: SectionEntry[];
}

const energyModelModules = import.meta.glob<SectionModule>("../../content/energy-model/*.mdx", { eager: true });
// These globs are deliberately non-recursive: `envelope/assemblies/` and
// `mechanical/plans/` are card directories with their own loaders.
const envelopeModules = import.meta.glob<SectionModule>("../../content/envelope/*.mdx", { eager: true });
const windowsModules = import.meta.glob<SectionModule>("../../content/windows/*.mdx", { eager: true });
const mechanicalModules = import.meta.glob<SectionModule>("../../content/mechanical/*.mdx", { eager: true });

export const energyModelSections = () => loadSections(energyModelModules);
export const envelopeSections = () => loadSections(envelopeModules);
export const windowsSections = () => loadSections(windowsModules);
export const mechanicalSections = () => loadSections(mechanicalModules);

/**
 * The Summary page's single section.
 *
 * Built from the static import rather than a glob: Summary is one fixed
 * section whose frontmatter also feeds layout-level hero props, and globbing
 * `content/*.mdx` would sweep in the orphaned `appendix.mdx` (D8).
 */
export const summarySection = (): SectionEntry => ({
  id: "summary",
  kicker: summary.kicker,
  title: summary.title,
  frontmatter: summary,
  Content: Summary,
});

const sectionsByPage: Record<ReportPage["key"], () => SectionEntry[]> = {
  summary: () => [summarySection()],
  energyModel: energyModelSections,
  envelope: envelopeSections,
  windows: windowsSections,
  mechanical: mechanicalSections,
};

/**
 * All five groups in page order — the order the PDF and its TOC follow.
 * Order comes from `reportPageOrder` so it cannot drift from the site nav.
 *
 * Every group is guaranteed non-empty: `loadSections` throws on an empty
 * directory, and Summary is a single static section. Callers may rely on
 * `sections[0]` existing.
 */
export function loadAllPageSections(): PageSections[] {
  return reportPageOrder.map((page) => ({ page, sections: sectionsByPage[page.key]() }));
}
