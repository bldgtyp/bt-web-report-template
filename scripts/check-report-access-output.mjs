import { readFile } from "node:fs/promises";
import { join } from "node:path";

const pages = [
  "index.html",
  "building_envelope/index.html",
  "energy_model/index.html",
  "mechanical/index.html",
  "print/index.html",
  "windows/index.html",
];

for (const page of pages) {
  const html = await readFile(join("dist", page), "utf8");
  if (!html.includes('<meta name="robots" content="noindex, nofollow">')) {
    throw new Error(`${page} does not include noindex/nofollow robots metadata.`);
  }
}

const robots = await readFile(join("dist", "robots.txt"), "utf8");
if (robots !== "User-agent: *\nDisallow: /\n") {
  throw new Error("dist/robots.txt does not disallow crawlers.");
}

console.log("report access output ok");
