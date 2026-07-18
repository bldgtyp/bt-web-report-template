import { describe, expect, it } from "vitest";

describe("report access defaults", () => {
  it("serves a renderer-owned robots.txt that disallows crawlers", async () => {
    const route = await import("../src/pages/robots.txt");
    const response = await route.GET();

    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toBe("User-agent: *\nDisallow: /\n");
  });
});
