import { describe, expect, it } from "vitest";

import { resolveVar } from "../src/data/resolve-var";

describe("resolveVar", () => {
  it("renders numeric project.yaml fields as prose strings", () => {
    const project = {
      building: {
        total_num_occupants: 4,
      },
    };

    expect(resolveVar(project as never, "building.total_num_occupants")).toEqual({
      found: true,
      value: "4",
    });
  });

  it("rejects object containers", () => {
    const project = {
      building: {
        total_num_occupants: 4,
      },
    };

    expect(resolveVar(project as never, "building")).toEqual({
      found: false,
      reason: "non-scalar",
    });
  });
});
