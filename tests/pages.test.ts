import { describe, expect, it } from "vitest";

import {
  reportPageOrder,
  reportPageOrderFor,
  validateCustomPages,
} from "../src/data/pages";

describe("reportPageOrderFor", () => {
  it("preserves the five core pages when no custom pages are configured", () => {
    expect(reportPageOrderFor()).toEqual(reportPageOrder);
    expect(reportPageOrderFor().map(({ href }) => href)).toEqual([
      "/",
      "/energy_model/",
      "/building_envelope/",
      "/windows/",
      "/mechanical/",
    ]);
  });

  it("appends custom pages in project order with derived routes and kickers", () => {
    const order = reportPageOrderFor([
      { slug: "resilience", label: "Resilience" },
      { slug: "design-notes", label: "Design Notes" },
    ]);

    expect(order.slice(-2)).toEqual([
      {
        kind: "custom",
        key: "custom:resilience",
        slug: "resilience",
        href: "/resilience/",
        label: "Resilience",
        kicker: "05",
      },
      {
        kind: "custom",
        key: "custom:design-notes",
        slug: "design-notes",
        href: "/design-notes/",
        label: "Design Notes",
        kicker: "06",
      },
    ]);
  });

  it("rejects duplicate slugs and names the collision", () => {
    expect(() =>
      validateCustomPages([
        { slug: "resilience", label: "Resilience" },
        { slug: "resilience", label: "Duplicate" },
      ]),
    ).toThrow('Custom page slug "resilience" is duplicated.');
  });

  it.each(["energy_model", "building_envelope", "windows", "mechanical", "print", "admin", "assets"])(
    "rejects reserved route %s",
    (slug) => {
      expect(() => reportPageOrderFor([{ slug, label: "Collision" }])).toThrow(
        `Custom page slug "${slug}" collides with a reserved route.`,
      );
    },
  );
});
