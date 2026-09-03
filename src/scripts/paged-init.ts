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
  const TABLE_PARTS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH"]);

  const elementFor = (node: Node): HTMLElement | null =>
    node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;

  // Paged.js indexes rendered nodes by data-ref/id to find where the next
  // source node belongs; a duplicated ref would misdirect that lookup.
  function detachedClone(source: Element): HTMLElement {
    const clone = source.cloneNode(true) as HTMLElement;
    for (const element of [clone, ...clone.querySelectorAll("[data-ref], [id]")]) {
      element.removeAttribute("data-ref");
      element.removeAttribute("id");
    }
    return clone;
  }

  // Paged.js 0.4 drops the <caption> and <thead> when it continues a table on
  // the next page, so a reader meets a wall of unlabelled rows. This handler
  // clones both back onto every continuation.
  //
  // It runs on `renderNode` — while the page is still being laid out — not on
  // `afterPageLayout`. Paged.js decides how many rows fit by measuring the
  // page as it renders, so anything added after that decision is pure extra
  // height: the last row of every continuation page ends up pushed past the
  // page box and clipped out of the PDF. Inserting as the continuation table
  // is rebuilt means the row that no longer fits is carried to the next page
  // instead of disappearing.
  class RepeatTableHeader extends paged.Handler {
    renderNode(clone: Node, node: Node): void {
      const cloneElement = elementFor(clone);
      if (!cloneElement || !TABLE_PARTS.has(cloneElement.tagName)) {
        return;
      }
      const splitTable = cloneElement.closest<HTMLTableElement>("table[data-split-from]");
      if (!splitTable) {
        return;
      }
      const sourceTable = elementFor(node)?.closest("table");
      if (!sourceTable) {
        return;
      }

      if (!splitTable.querySelector("caption")) {
        const sourceCaption = sourceTable.querySelector("caption");
        const sourceTitle = sourceCaption?.querySelector(".btwr-table__title");
        if (sourceCaption && sourceTitle) {
          // Title only. Repeating the subtitle on every page of a long
          // schedule is noise, and "(continued)" is what tells the reader
          // this is the same table rather than a new one.
          const repeated = detachedClone(sourceCaption);
          repeated.querySelector(".btwr-table__subtitle")?.remove();
          const title = repeated.querySelector(".btwr-table__title");
          if (title) {
            title.textContent = `${sourceTitle.textContent?.trim() ?? ""} (continued)`;
          }
          repeated.setAttribute("data-btwr-repeated-caption", "true");
          splitTable.insertBefore(repeated, splitTable.firstChild);
        }
      }

      if (!splitTable.querySelector("thead")) {
        const sourceThead = sourceTable.querySelector("thead");
        if (sourceThead) {
          const repeated = detachedClone(sourceThead);
          repeated.setAttribute("data-btwr-repeated-header", "true");
          const caption = splitTable.querySelector("caption");
          splitTable.insertBefore(repeated, caption ? caption.nextSibling : splitTable.firstChild);
        }
      }
    }
  }

  // A fragmentable table can leave its opening box on the previous page with
  // no rows in it: sometimes a bare 2px sliver that prints as a stray rule
  // under whatever came before, sometimes the caption alone with every row
  // overleaf. `break-after: avoid` on the caption and thead walks the break
  // back where it can, but once Paged.js has chosen a row as the break token
  // those hints no longer apply, so the leftover is removed here.
  //
  // Safe to do after layout, unlike adding content: the fragment carries
  // nothing the continuation does not repeat, and dropping it only frees
  // space at the foot of a page that is already paginated.
  class DropRowlessTableFragment extends paged.Handler {
    afterPageLayout(pageElement: HTMLElement): void {
      for (const wrap of pageElement.querySelectorAll(".btwr-table-wrap")) {
        if (!wrap.querySelector("tbody tr")) {
          wrap.remove();
        }
      }
    }
  }

  paged.registerHandlers(RepeatTableHeader, DropRowlessTableFragment);
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
