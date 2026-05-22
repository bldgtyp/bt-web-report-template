import { describe, expect, it } from "vitest";

import { createAssemblyArchiveBlob } from "../src/scripts/assembly-archive";

describe("assembly archive download", () => {
  it("builds a zip from the files requested at click time", async () => {
    const requestedUrls: string[] = [];
    const blob = await createAssemblyArchiveBlob(
      [
        { url: "/assets/envelope/assemblies/wall.png", filename: "wall.png" },
        { url: "/assets/envelope/assemblies/roof.png", filename: "roof.png" },
      ],
      {
        now: new Date("2026-05-21T12:00:00Z"),
        fetcher: async (url) => {
          requestedUrls.push(String(url));
          return new Response(`bytes:${url}`, { status: 200 });
        },
      },
    );

    const bytes = Buffer.from(await blob.arrayBuffer());

    expect(requestedUrls).toEqual([
      "/assets/envelope/assemblies/wall.png",
      "/assets/envelope/assemblies/roof.png",
    ]);
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.includes(Buffer.from("wall.png"))).toBe(true);
    expect(bytes.includes(Buffer.from("roof.png"))).toBe(true);
    expect(bytes.includes(Buffer.from("bytes:/assets/envelope/assemblies/wall.png"))).toBe(true);
    expect(bytes.readUInt32LE(bytes.length - 22)).toBe(0x06054b50);
  });

  it("fails when an assembly asset cannot be fetched", async () => {
    await expect(
      createAssemblyArchiveBlob([{ url: "/missing.png", filename: "missing.png" }], {
        fetcher: async () => new Response("not found", { status: 404 }),
      }),
    ).rejects.toThrow("Could not fetch assembly asset /missing.png: 404");
  });
});
