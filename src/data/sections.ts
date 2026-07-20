// Section composition from content presence.
//
// A report page renders exactly the `.mdx` files present in its content
// directory: pages hand an eager `import.meta.glob` record to `loadSections`
// and get back an ordered list. Delete a file from a project repo and the
// section, its page-TOC entry, and its print counterparts all disappear with
// no renderer edit. See the README's content section, and the design record in
// planning/archive/dated/2026-07-20/per-project-sections/ (workspace-local).
//
// Ordering is by frontmatter `kicker` — the zero-padded string already shown
// in the TOC and section headers. This is deliberately different from the
// numeric `order` used by assembly/plan cards (AssemblyCards.astro): `kicker`
// is display-bearing, `order` is purely positional and never rendered.

export interface SectionFrontmatter {
  kicker: string;
  title: string;
  /** Overrides the filename-derived anchor id. Needed where an existing
   * section's rendered id never matched its filename. */
  section_id?: string;
  callout_label?: string;
  callout_body?: string;
  [key: string]: unknown;
}

export interface SectionModule {
  default: unknown;
  frontmatter: SectionFrontmatter;
}

export interface SectionEntry {
  id: string;
  kicker: string;
  title: string;
  frontmatter: SectionFrontmatter;
  Content: unknown;
}

export interface SectionTocItem {
  href: string;
  label: string;
  number: string;
}

/**
 * Build the ordered section list for one content directory.
 *
 * Every failure here is a build error rather than a silently thin page: an
 * empty directory means a scrape or symlink failure, and duplicate or missing
 * kickers mean a numbering mistake the author needs to see. Messages name the
 * offending files because these surface during `btwr build` on real projects.
 */
export function loadSections(modules: Record<string, SectionModule>): SectionEntry[] {
  const paths = Object.keys(modules).sort();

  if (paths.length === 0) {
    throw new Error(
      "No section .mdx files found for this page. Expected at least one; " +
        "an empty content directory usually means a failed scrape or a broken content symlink.",
    );
  }

  const entries = paths.map((path) => {
    const { frontmatter, default: Content } = modules[path];

    if (!frontmatter?.kicker) {
      throw new Error(`Section "${path}" is missing the required "kicker" frontmatter key.`);
    }

    return {
      id: frontmatter.section_id ?? filenameSlug(path),
      kicker: frontmatter.kicker,
      title: frontmatter.title,
      frontmatter,
      Content,
      path,
    };
  });

  assertUnique(entries, (entry) => entry.id, "section id");
  assertUnique(entries, (entry) => entry.kicker, "kicker");

  return entries
    .sort((left, right) => left.kicker.localeCompare(right.kicker) || left.path.localeCompare(right.path))
    .map(({ path: _path, ...section }) => section);
}

/**
 * A page's bespoke trimmings, keyed by section id.
 *
 * The glob supplies the set and order of sections; this supplies the charts,
 * tables, and figures a given section injects. `Before` fills the
 * `before-content` slot, `Children` the default slot, and both receive
 * `report` and `frontmatter`. A section with no entry renders as prose only —
 * which is what lets a project delete its `.mdx` and have the section vanish.
 * A leftover entry for a deleted section is simply never looked up.
 *
 * Components are `any` because Astro component types aren't expressible here;
 * `ReportSection`'s own `Content` prop has the same constraint.
 */
export interface SectionExtras {
  Before?: any;
  Children?: any;
}

/** Derive TOC entries from a loaded section list so no page hand-maintains one. */
export function tocItemsFromSections(sections: SectionEntry[]): SectionTocItem[] {
  return sections.map((section) => ({
    href: `#${section.id}`,
    label: section.title,
    number: section.kicker,
  }));
}

/** The `<ReportSection>` prop subset, so pages spread a single expression. */
export function sectionProps(section: SectionEntry) {
  return {
    id: section.id,
    kicker: section.kicker,
    title: section.title,
    Content: section.Content,
    callout_label: section.frontmatter.callout_label,
    callout_body: section.frontmatter.callout_body,
  };
}

function filenameSlug(path: string): string {
  return path.split("/").pop()?.replace(/\.mdx$/, "") ?? path;
}

function assertUnique<T extends { path: string }>(entries: T[], key: (entry: T) => string, label: string): void {
  const seen = new Map<string, string>();

  for (const entry of entries) {
    const value = key(entry);
    const previous = seen.get(value);

    if (previous) {
      throw new Error(`Duplicate ${label} "${value}" in "${previous}" and "${entry.path}".`);
    }

    seen.set(value, entry.path);
  }
}
