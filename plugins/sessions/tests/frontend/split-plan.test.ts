import { describe, expect, it } from "vitest";
import { planSplit } from "../../src/frontend/split-plan.js";

const summary = (id: string, panes: Array<string | null>, full = false) => ({
  id,
  label: id,
  full,
  panes: panes.map((tabId, i) => ({ id: `${id}-p${i + 1}`, index: i + 1, tabId, label: tabId })),
});

describe("planSplit", () => {
  it("puts the tab in an empty pane of an existing split", () => {
    expect(planSplit("t9", [summary("sp1", ["t1", null])])).toEqual({
      kind: "addToPane",
      tabId: "t9",
      splitTabId: "sp1",
      paneId: "sp1-p2",
    });
  });

  it("adds a pane to a split that has room but no empty pane", () => {
    expect(planSplit("t9", [summary("sp1", ["t1", "t2"], false)])).toEqual({
      kind: "addPane",
      tabId: "t9",
      splitTabId: "sp1",
      edge: "right",
    });
  });

  it("starts a new split with the tab when every split is full or none exists", () => {
    expect(planSplit("t9", [summary("sp1", ["t1", "t2"], true)])).toEqual({ kind: "split", tabId: "t9", edge: "right" });
    expect(planSplit("t9", [])).toEqual({ kind: "split", tabId: "t9", edge: "right" });
  });

  it("does nothing when the tab already sits in a split pane", () => {
    expect(planSplit("t1", [summary("sp1", ["t1", null])])).toBeNull();
  });
});
