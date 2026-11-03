import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceLayout } from "@/shell/controller/use-workspace-layout";
import { resetShellBridge, tabsApi } from "@/plugin-host/shell-bridge";
import { registerTabType, resetTabTypes } from "@/shell/tab-registry";
import type { Tab } from "@/types/ui-types";
import { addSplitTab, makeSplitTab } from "@/shell/split/split-tabs";
import {
  createPane,
  createSplitNode,
  createSplitState,
} from "@/shell/split/split-tree";

afterEach(() => {
  cleanup();
  resetShellBridge();
  resetTabTypes();
});
describe("partial plugin restoration", () => {
  it("reuses a restored view and preserves unrelated connections", async () => {
    registerTabType({ id: "terminal", component: () => null });
    const host = { id: "1", name: "host", syncId: "h1" };
    const own = {
      id: "owned",
      instanceId: "i1",
      type: "terminal",
      label: "old",
      host,
    };
    const unrelated = { ...own, id: "unrelated", instanceId: "i2" };
    const tabsRef = { current: [own, unrelated] as Tab[] };
    const state = {
      tabs: tabsRef.current,
      tabsRef,
      baseTabsReady: true,
      activeTabId: "owned",
      activeTabIdRef: { current: "owned" },
      hostsRef: { current: [host] },
      suppressPaneTargetRef: { current: false },
      pendingPaneTargetRef: { current: null },
      doCloseTab: vi.fn(),
      openTab: vi.fn(),
      updateTabData: vi.fn(),
      renameTab: vi.fn(),
      setActiveTabId: vi.fn(),
      setTabs: vi.fn((fn: (tabs: Tab[]) => Tab[]) => {
        tabsRef.current = fn(tabsRef.current);
      }),
    };
    renderHook(() =>
      useWorkspaceLayout(
        state as never,
        {
          left: { view: "sessions", open: true, width: 300 },
          right: { view: null, width: 300 },
        } as never,
      ),
    );
    await act(() =>
      tabsApi.applyLayout(
        {
          version: 2,
          tabs: [
            {
              slotId: "s",
              type: "terminal",
              label: "Current",
              hostSyncId: "h1",
              data: { sessionsSessionId: "session1", tmuxSession: "current" },
            },
          ],
          activeSlotId: "s",
        },
        { mode: "merge", existingTabs: { s: "owned" } },
      ),
    );
    expect(state.doCloseTab).not.toHaveBeenCalled();
    expect(state.openTab).not.toHaveBeenCalled();
    expect(state.updateTabData).toHaveBeenCalledWith("owned", {
      sessionsSessionId: "session1",
      tmuxSession: "current",
    });
    expect(tabsRef.current.find((tab) => tab.id === "unrelated")).toBe(
      unrelated,
    );
    // Basic core restoration may have already recovered this split.
    const split = makeSplitTab(
      "split-instance",
      "Work",
      createSplitState(
        createSplitNode("row", [createPane("owned"), createPane(null)]),
      ),
    );
    tabsRef.current = addSplitTab(tabsRef.current, split);
    const standalone = tabsRef.current.find((tab) => tab.id === "unrelated")!;
    tabsRef.current = [
      split,
      standalone,
      ...tabsRef.current.filter(
        (tab) => tab.id !== split.id && tab.id !== standalone.id,
      ),
    ];
    const layout = tabsApi.getLayout({ tabIds: ["owned", "unrelated"] })!;
    const slots = layout.tabs as Array<{
      slotId: string;
      sourceInstanceId: string;
    }>;
    const mapping = Object.fromEntries(
      slots.map((slot) => [
        slot.slotId,
        slot.sourceInstanceId === "i1" ? "owned" : "unrelated",
      ]),
    );
    tabsRef.current = [
      standalone,
      ...tabsRef.current.filter((tab) => tab.id !== standalone.id),
    ];
    await act(() =>
      tabsApi.applyLayout(layout, {
        mode: "merge",
        existingTabs: mapping,
      }),
    );
    expect(
      tabsRef.current
        .filter((tab) => !tab.parentSplitTabId)
        .map((tab) => tab.id),
    ).toEqual([split.id, "unrelated"]);
    expect(
      tabsRef.current.filter((tab) => tab.type === "split-screen"),
    ).toHaveLength(1);
    expect(tabsRef.current.find((tab) => tab.type === "split-screen")?.id).toBe(
      split.id,
    );
  });
});
