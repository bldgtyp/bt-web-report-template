export const DEFAULT_CERTIFICATION_PATHWAY_IDS = [
  "phi-classic",
  "phi-leb",
  "phius-core-2024",
  "phius-zero-2024",
];

export function resolveCertificationPathwaySelection(config, catalogIds, defaultIds) {
  const validIds = new Set(catalogIds);
  const validIdList = catalogIds.join(", ");
  const selectedIds = config?.show ?? defaultIds;
  const seen = new Set();

  for (const id of selectedIds) {
    if (!validIds.has(id)) {
      throw new Error(`Unknown certification pathway ID "${id}". Valid IDs: ${validIdList}.`);
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate certification pathway ID "${id}". Valid IDs: ${validIdList}.`);
    }
    seen.add(id);
  }

  const recommended = config?.recommended ?? undefined;
  if (recommended !== undefined && !validIds.has(recommended)) {
    throw new Error(`Unknown recommended certification pathway ID "${recommended}". Valid IDs: ${validIdList}.`);
  }
  if (recommended !== undefined && !seen.has(recommended)) {
    throw new Error(
      `Recommended certification pathway ID "${recommended}" is not included in show. Valid IDs: ${validIdList}.`,
    );
  }

  return { selectedIds: [...selectedIds], recommended };
}
