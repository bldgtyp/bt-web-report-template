import { describe, expect, it } from "vitest";

// @ts-expect-error no declaration file for the local remark plugin
import remarkFullUrlLinksNewTab from "../src/markdown/remark-full-url-links-new-tab.mjs";
// Plain JS keeps the plugin loadable from astro.config.mjs.
// @ts-expect-error no declaration file for the local remark plugin
import remarkTinaTrailingStrongWhitespace, {
  splitTinaStrongText,
} from "../src/markdown/remark-tina-trailing-strong-whitespace.mjs";

describe("TinaCMS markdown normalization", () => {
  it("moves Tina's trailing bold whitespace outside the strong node", () => {
    expect(splitTinaStrongText("**Code-Minimum: **A version")).toEqual([
      {
        type: "strong",
        children: [{ type: "text", value: "Code-Minimum:" }],
      },
      { type: "text", value: " A version" },
    ]);
  });

  it("rewrites parsed MDX text nodes before Astro renders them", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "list",
          children: [
            {
              type: "listItem",
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "**Code-Minimum: **A version" }],
                },
              ],
            },
          ],
        },
      ],
    };

    remarkTinaTrailingStrongWhitespace()(tree);

    expect(tree.children[0].children[0].children[0].children).toEqual([
      {
        type: "strong",
        children: [{ type: "text", value: "Code-Minimum:" }],
      },
      { type: "text", value: " A version" },
    ]);
  });

  it("leaves normal markdown text nodes unchanged", () => {
    expect(splitTinaStrongText("Code-Minimum: A version")).toBeNull();
  });
});

describe("MDX full URL links", () => {
  it("opens markdown links with full URLs in a new tab", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "https://www.example.com/path#section",
              children: [{ type: "text", value: "Example" }],
            },
          ],
        },
      ],
    };

    remarkFullUrlLinksNewTab()(tree);

    expect(tree.children[0].children[0].data.hProperties).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("leaves internal navigation links unchanged", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "#site-energy",
              children: [{ type: "text", value: "Site energy" }],
            },
          ],
        },
      ],
    };

    remarkFullUrlLinksNewTab()(tree);

    expect(tree.children[0].children[0].data).toBeUndefined();
  });

  it("opens literal MDX anchor elements with full URLs in a new tab", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "mdxJsxTextElement",
          name: "a",
          attributes: [{ type: "mdxJsxAttribute", name: "href", value: "http://example.com" }],
          children: [{ type: "text", value: "Example" }],
        },
      ],
    };

    remarkFullUrlLinksNewTab()(tree);

    expect(tree.children[0].attributes).toEqual([
      { type: "mdxJsxAttribute", name: "href", value: "http://example.com" },
      { type: "mdxJsxAttribute", name: "target", value: "_blank" },
      { type: "mdxJsxAttribute", name: "rel", value: "noopener noreferrer" },
    ]);
  });
});
