import { describe, expect, it } from "vitest";

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
