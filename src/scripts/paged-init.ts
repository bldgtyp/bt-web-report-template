// Paged.js bootstrapper for the /print route.
// Set ?paged=0 in the URL to skip pagination during dev iteration.

import { assertPrintableEmbedAssetsReadable } from "./printable-embed-assets";

export const PAGED_STATE_ATTR = "data-paged-rendered";
export const PAGED_ERROR_ATTR = "data-paged-error";
export const PAGED_STATE = {
  ready: "true",
  skipped: "skipped",
  error: "error",
} as const;

function isPrintRoute(): boolean {
  return document.documentElement.dataset.printRoute === "true";
}

function pagedIsDisabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("paged") === "0";
}

async function waitForDom(): Promise<void> {
  if (document.readyState === "loading") {
    await new Promise<void>((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }
}

async function waitForFonts(): Promise<void> {
  if (document.fonts && typeof document.fonts.ready?.then === "function") {
    await document.fonts.ready;
  }
}

async function waitForImages(): Promise<void> {
  const pending = Array.from(document.images).filter((img) => !img.complete);
  if (pending.length === 0) {
    return;
  }
  // Phius/PHI certification logos use loading="lazy" and would otherwise
  // never start loading in headless capture, blocking pagination forever.
  for (const img of pending) {
    img.loading = "eager";
    img.decoding = "sync";
  }
  await Promise.all(
    pending.map((img) => waitForImage(img)),
  );
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
    if (image.complete) {
      finish();
    }
  });
}

async function paginate(): Promise<void> {
  await waitForDom();
  await Promise.all([waitForFonts(), waitForImages()]);
  assertPrintableEmbedAssetsReadable(document);
  const paged = await import("pagedjs");
  registerCustomHandlers(paged);
  const previewer = new paged.Previewer();
  await previewer.preview();
  document.documentElement.setAttribute(PAGED_STATE_ATTR, PAGED_STATE.ready);
}

function registerCustomHandlers(paged: typeof import("pagedjs")): void {
  // Paged.js 0.4 drops <thead> on split-table continuations; this handler
  // clones the source thead back so column headers repeat on every page a
  // table covers.
  //
  // It runs on `renderNode` — while the page is still being laid out — not on
  // `afterPageLayout`. Paged.js decides how many rows fit by measuring the
  // page as it renders, so a header added after that decision is pure extra
  // height: the last row of every continuation page ends up pushed past the
  // page box and clipped out of the PDF. Inserting it as the continuation
  // table is rebuilt means the row that no longer fits is carried to the next
  // page instead of disappearing.
  const TABLE_PARTS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH"]);

  const elementFor = (node: Node): HTMLElement | null =>
    node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

  class RepeatTableHeader extends paged.Handler {
    renderNode(clone: Node, node: Node): void {
      const cloneElement = elementFor(clone);
      if (!cloneElement || !TABLE_PARTS.has(cloneElement.tagName)) {
        return;
      }
      const splitTable = cloneElement.closest<HTMLTableElement>("table[data-split-from]");
      if (!splitTable || splitTable.querySelector("thead")) {
        return;
      }
      const sourceThead = elementFor(node)?.closest("table")?.querySelector("thead");
      if (!sourceThead) {
        return;
      }
      const repeated = sourceThead.cloneNode(true) as HTMLElement;
      // Paged.js indexes rendered nodes by data-ref/id to find where the next
      // source node belongs; a duplicated ref would misdirect that lookup.
      repeated.removeAttribute("id");
      repeated.removeAttribute("data-ref");
      for (const descendant of repeated.querySelectorAll("[data-ref], [id]")) {
        descendant.removeAttribute("data-ref");
        descendant.removeAttribute("id");
      }
      repeated.setAttribute("data-btwr-repeated-header", "true");
      splitTable.insertBefore(repeated, splitTable.firstChild);
    }
  }

  paged.registerHandlers(RepeatTableHeader);
}

if (isPrintRoute()) {
  if (pagedIsDisabled()) {
    document.documentElement.setAttribute(PAGED_STATE_ATTR, PAGED_STATE.skipped);
  } else {
    paginate().catch((error) => {
      console.error("[paged-init] pagination failed", error);
      const message = error instanceof Error ? error.message : String(error);
      document.documentElement.setAttribute(PAGED_ERROR_ATTR, message);
      document.documentElement.setAttribute(PAGED_STATE_ATTR, PAGED_STATE.error);
    });
  }
}
