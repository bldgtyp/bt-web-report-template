import type { ReportPage } from "../data/pages";

export interface PrintableEmbedAssetFailure {
  embedId: string;
  pageId: string;
  pageKind: ReportPage["kind"] | "unknown";
  src: string;
}

export function findUnreadablePrintableEmbedAssets(root: ParentNode): PrintableEmbedAssetFailure[] {
  const embeds = root.querySelectorAll<HTMLElement>("[data-btwr-printable-embed]");

  return Array.from(embeds).flatMap((embed) => {
    const image = embed.querySelector<HTMLImageElement>("img");
    if (image?.complete && image.naturalWidth > 0) {
      return [];
    }

    const section = embed.closest<HTMLElement>("[data-btwr-page-id]");
    const rawPageKind = section?.dataset.btwrPageKind;
    const pageKind = rawPageKind === "custom" || rawPageKind === "core" ? rawPageKind : "unknown";
    return [
      {
        embedId: embed.dataset.btwrEmbedId || "unknown",
        pageId: section?.dataset.btwrPageId || "unknown",
        pageKind,
        src: image?.getAttribute("src") || "unknown",
      },
    ];
  });
}

export function assertPrintableEmbedAssetsReadable(root: ParentNode): void {
  const failures = findUnreadablePrintableEmbedAssets(root);
  if (failures.length === 0) {
    return;
  }

  const diagnostics = failures.map(({ embedId, pageId, pageKind, src }) => {
    const pageType = pageKind === "custom" ? "custom page" : pageKind === "core" ? "report page" : "page";
    return `Printable embed asset is missing or unreadable for ${pageType} "${pageId}", embed "${embedId}": ${src}`;
  });
  throw new Error(diagnostics.join("\n"));
}
