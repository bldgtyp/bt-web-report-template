import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import fullUrlLinksNewTab from "./src/markdown/remark-full-url-links-new-tab.mjs";
import tinaTrailingStrongWhitespace from "./src/markdown/remark-tina-trailing-strong-whitespace.mjs";

// Astro dev only serves source + public/, but the bundled PDF is a build
// artifact written to dist/. This middleware lets `pnpm dev` resolve
// /report.pdf to the most recently built dist/report.pdf so the cover-page
// Download PDF button works end-to-end in dev after one `pnpm build:pdf`.
function devServeReportPdf() {
  return {
    name: "btwr-dev-serve-report-pdf",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use("/report.pdf", (_req, res, next) => {
          const pdfPath = resolve(process.cwd(), "dist", "report.pdf");
          if (!existsSync(pdfPath)) {
            return next();
          }
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Length", statSync(pdfPath).size);
          res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
          createReadStream(pdfPath).pipe(res);
        });
      },
    },
  };
}

export default defineConfig({
  integrations: [
    mdx({
      remarkPlugins: [tinaTrailingStrongWhitespace, fullUrlLinksNewTab],
    }),
    devServeReportPdf(),
  ],
  output: "static",
  devToolbar: {
    enabled: false,
  },
});
