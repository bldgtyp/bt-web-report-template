import type { CustomPageConfig } from "./project";
import { loadSections, type SectionEntry, type SectionModule } from "./sections";

const customPageModules = import.meta.glob<SectionModule>("../../content/custom/*/*.mdx", { eager: true });

export interface CustomPageModules {
  [slug: string]: Record<string, SectionModule> | undefined;
}

export function groupCustomPageModules(modules: Record<string, SectionModule>): CustomPageModules {
  const groups: CustomPageModules = {};

  for (const [path, module] of Object.entries(modules)) {
    const slug = customPageSlugFromPath(path);
    if (!slug) {
      throw new Error(`Custom page module path does not match content/custom/<slug>/<section>.mdx: "${path}".`);
    }
    (groups[slug] ??= {})[path] = module;
  }

  return groups;
}

export function loadCustomPageSectionsFromModules(
  slug: string,
  modules: Record<string, SectionModule> | undefined,
): SectionEntry[] {
  return loadSections(modules ?? {}).map((section) => ({
    ...section,
    id: `${slug}-${section.id}`,
  }));
}

export function loadCustomPageSections(slug: string): SectionEntry[] {
  const modules = groupedCustomPageModules[slug];
  try {
    return loadCustomPageSectionsFromModules(slug, modules);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Custom page "${slug}": ${message}`);
  }
}

export function assertCustomPageRegistrationMatchesModules(
  customPages: readonly CustomPageConfig[],
  modules: Record<string, SectionModule>,
): void {
  assertCustomPageRegistrationMatchesGroups(customPages, groupCustomPageModules(modules));
}

function assertCustomPageRegistrationMatchesGroups(
  customPages: readonly CustomPageConfig[],
  groups: CustomPageModules,
): void {
  const registered = new Set(customPages.map(({ slug }) => slug));

  for (const slug of registered) {
    if (!groups[slug]) {
      throw new Error(`Registered custom page "${slug}" has no content modules.`);
    }
  }
  for (const slug of Object.keys(groups)) {
    if (!registered.has(slug)) {
      throw new Error(`Custom page content for "${slug}" is not registered in project.yaml.`);
    }
  }
}

export function validateCustomPageModules(customPages: readonly CustomPageConfig[]): void {
  assertCustomPageRegistrationMatchesGroups(customPages, groupedCustomPageModules);
}

const groupedCustomPageModules = groupCustomPageModules(customPageModules);

function customPageSlugFromPath(path: string): string | undefined {
  return path.match(/(?:^|\/)content\/custom\/([^/]+)\/[^/]+\.mdx$/)?.[1];
}
