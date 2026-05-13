#!/usr/bin/env node
import { createReadStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

import { chromium } from "@playwright/test";

const root = process.cwd();
const distDir = resolve(root, "dist");
const indexPath = join(distDir, "index.html");
const outputPath = join(distDir, "report.pdf");

if (!existsSync(indexPath)) {
  throw new Error("dist/index.html is missing; run pnpm build before build:pdf");
}

await mkdir(distDir, { recursive: true });

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = resolve(distDir, `.${pathname}`);

  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.setHeader("Content-Type", contentType(filePath));
  createReadStream(filePath).pipe(response);
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.pdf({
    path: outputPath,
    format: "Letter",
    printBackground: true,
    margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
  });
  console.log(`wrote ${outputPath}`);
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css";
    case ".js":
      return "text/javascript";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json";
    case ".html":
    default:
      return "text/html";
  }
}
