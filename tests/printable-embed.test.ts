import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { validatePrintableEmbedProps } from "../src/components/printable-embed";
import {
  assertPrintableEmbedAssetsReadable,
  findUnreadablePrintableEmbedAssets,
} from "../src/scripts/printable-embed-assets";

describe("PrintableEmbed authoring contract", () => {
  it("accepts a root-relative print asset with intrinsic dimensions", () => {
    expect(
      validatePrintableEmbedProps({
        id: "comfort-bands",
        title: "Comfort bands",
        printSrc: "/assets/printable-embed/comfort-bands.svg",
        width: 1200,
        height: 675,
      }),
    ).toEqual({
      id: "comfort-bands",
      title: "Comfort bands",
      printSrc: "/assets/printable-embed/comfort-bands.svg",
      width: 1200,
      height: 675,
    });
  });

  it.each([
    { field: "printSrc", value: "https://example.com/chart.svg", error: /root-relative/ },
    { field: "width", value: 0, error: /width must be a positive integer/ },
    { field: "height", value: 4.5, error: /height must be a positive integer/ },
  ])("rejects invalid $field values", ({ field, value, error }) => {
    expect(() =>
      validatePrintableEmbedProps({
        id: "comfort-bands",
        title: "Comfort bands",
        printSrc: "/assets/printable-embed/comfort-bands.svg",
        width: 1200,
        height: 675,
        [field]: value,
      }),
    ).toThrow(error);
  });
});

describe("printable embed asset diagnostics", () => {
  function printDocument() {
    return new JSDOM(`
      <section data-btwr-page-id="resilience" data-btwr-page-kind="custom">
        <figure data-btwr-printable-embed data-btwr-embed-id="comfort-bands">
          <img src="/assets/printable-embed/comfort-bands.svg" alt="Comfort bands">
        </figure>
      </section>
    `).window.document;
  }

  it("accepts a loaded static representation", () => {
    const document = printDocument();
    const image = document.querySelector("img")!;
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 1200 },
    });

    expect(findUnreadablePrintableEmbedAssets(document)).toEqual([]);
    expect(() => assertPrintableEmbedAssetsReadable(document)).not.toThrow();
  });

  it("names the custom page, embed, and source when the asset is unreadable", () => {
    const document = printDocument();
    const image = document.querySelector("img")!;
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 0 },
    });

    expect(() => assertPrintableEmbedAssetsReadable(document)).toThrow(
      'Printable embed asset is missing or unreadable for custom page "resilience", embed "comfort-bands": /assets/printable-embed/comfort-bands.svg',
    );
  });
});
