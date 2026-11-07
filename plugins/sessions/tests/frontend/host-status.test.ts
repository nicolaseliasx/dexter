import { describe, expect, it } from "vitest";
import { hostStatusView } from "../../src/frontend/host-status.js";

describe("hostStatusView", () => {
  it("shows online and reachable hosts in a fixed green, whatever the theme", () => {
    for (const status of ["online", "reachable"] as const) {
      const view = hostStatusView(status);
      expect(view?.label).toBe(status);
      expect(view?.className).toContain("text-emerald-500");
      expect(view?.className).not.toContain("accent");
    }
  });

  it("shows offline hosts in a fixed red", () => {
    const view = hostStatusView("offline");
    expect(view?.className).toContain("text-red-500");
    expect(view?.className).not.toContain("accent");
  });

  it("shows nothing for a host that was not checked yet", () => {
    expect(hostStatusView("unknown")).toBeNull();
  });
});
