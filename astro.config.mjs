import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import fullUrlLinksNewTab from "./src/markdown/remark-full-url-links-new-tab.mjs";
import tinaTrailingStrongWhitespace from "./src/markdown/remark-tina-trailing-strong-whitespace.mjs";

export default defineConfig({
  integrations: [
    mdx({
      remarkPlugins: [tinaTrailingStrongWhitespace, fullUrlLinksNewTab],
    }),
  ],
  output: "static",
  devToolbar: {
    enabled: false,
  },
});
