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
  class RepeatTableHeader extends paged.Handler {
    afterPageLayout(
      pageElement: HTMLElement,
      _page: unknown,
      _breakToken: unknown,
      chunker: { source: HTMLElement },
    ): void {
      const splitTables = pageElement.querySelectorAll<HTMLTableElement>(
        "table[data-split-from]",
      );
      for (const splitTable of splitTables) {
        if (splitTable.querySelector("thead")) {
          continue;
        }
        const originalId = splitTable.getAttribute("data-split-from");
        if (!originalId) {
          continue;
        }
        const original = chunker.source.querySelector<HTMLTableElement>(
          `[data-ref="${originalId}"], #${CSS.escape(originalId)}`,
        );
        const thead = original?.querySelector("thead");
        if (!thead) {
          continue;
        }
        splitTable.insertBefore(thead.cloneNode(true), splitTable.firstChild);
      }
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
