import type { SectionEntry, SectionExtras } from "./sections";

export type SectionExtraSlot = keyof SectionExtras;

export interface SectionExtraRegistration {
  component: any;
  slot: SectionExtraSlot;
}

export interface SectionExtrasRegistry {
  readonly [name: string]: SectionExtraRegistration | undefined;
}

export function resolveSectionExtras(
  sections: readonly SectionEntry[],
  registry: SectionExtrasRegistry,
): Record<string, SectionExtras> {
  const resolved: Record<string, SectionExtras> = {};
  const validNames = Object.keys(registry).sort();

  for (const section of sections) {
    const requested = section.frontmatter.extras;
    if (requested === undefined) {
      continue;
    }
    if (!Array.isArray(requested) || requested.some((name) => typeof name !== "string")) {
      throw new Error(`${section.sourcePath}: "extras" must be a list of component names.`);
    }

    const seenNames = new Set<string>();
    const seenSlots = new Map<SectionExtraSlot, string>();
    const sectionExtras: SectionExtras = {};

    for (const name of requested) {
      if (seenNames.has(name)) {
        throw new Error(`${section.sourcePath}: duplicate extra "${name}".`);
      }
      const registration = registry[name];
      if (!registration) {
        const choices = validNames.length > 0 ? validNames.join(", ") : "none";
        throw new Error(`${section.sourcePath}: unknown extra "${name}". Valid names: ${choices}.`);
      }
      const previousName = seenSlots.get(registration.slot);
      if (previousName) {
        throw new Error(
          `${section.sourcePath}: extras "${previousName}" and "${name}" both use the ${registration.slot} slot.`,
        );
      }

      sectionExtras[registration.slot] = registration.component;
      seenNames.add(name);
      seenSlots.set(registration.slot, name);
    }

    resolved[section.id] = sectionExtras;
  }

  return resolved;
}
