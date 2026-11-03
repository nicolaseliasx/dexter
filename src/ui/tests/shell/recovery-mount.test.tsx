import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const ctx = vi.hoisted(() => ({
  ready: false,
  render: vi.fn(() => null),
  node: null as HTMLElement | null,
}));
vi.mock("@/shell/controller/ShellControllerProvider", () => ({
  useShellController: () => ({
    tabs: {
      ready: ctx.ready,
      list: [{ id: "t1", type: "terminal" }],
      activeId: "t1",
    },
    split: { paneIdByTabId: new Map() },
    callbacks: {},
  }),
  useTabStageStore: () => ({
    subscribe: () => () => {},
    version: () => 0,
    place: () => {},
    portalOrder: (tabs: unknown[]) => tabs,
    getNode: () => ctx.node,
  }),
}));
vi.mock("@/shell/tabUtils", () => ({ renderTabContent: ctx.render }));
import { TabPortals } from "@/shell/stage/TabPortals";
afterEach(() => {
  cleanup();
  ctx.render.mockClear();
  ctx.ready = false;
});
describe("recovery mount barrier", () => {
  it("does not mount a terminal before plugins finish resolving restored identities", () => {
    ctx.node = document.createElement("div");
    const view = render(<TabPortals />);
    expect(ctx.render).not.toHaveBeenCalled();
    ctx.ready = true;
    view.rerender(<TabPortals />);
    expect(ctx.render).toHaveBeenCalledOnce();
  });
});
