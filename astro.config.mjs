import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import tinaTrailingStrongWhitespace from "./src/markdown/remark-tina-trailing-strong-whitespace.mjs";

export default defineConfig({
  integrations: [
    mdx({
      remarkPlugins: [tinaTrailingStrongWhitespace],
    }),
  ],
  output: "static",
  devToolbar: {
    enabled: false,
  },
});
