import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { createSessionRecovery } from "../../src/frontend/SessionRecovery.js";
import { writeCache } from "../../src/frontend/recovery.js";

const context = vi.hoisted(() => ({ shell: null as any, warning: vi.fn() }));
vi.mock("@termix-ssh/plugin-sdk/frontend", () => ({
  useCurrentUser: () => ({ userId: "u1" }),
  useShell: () => context.shell,
  useToast: () => ({ warning: context.warning }),
}));
const disposers: (() => void)[] = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  context.warning.mockClear();
});
afterEach(() => {
  disposers.splice(0).forEach((off) => off());
  cleanup();
});

function start(
  views: any[],
  get = vi.fn(async () => ({
    data: {
      data: {
        id: "s1",
        hostId: 1,
        displayName: "Current",
        tmuxSessionName: "current",
        endedAt: null,
      },
    },
  })),
) {
  let restore!: () => Promise<void>;
  let ready!: () => Promise<void>;
  let Controller!: ComponentType;
  context.shell = {
    tabs: { list: views.map((view) => ({ type: "terminal", ...view })) },
    hosts: { loaded: true, list: [{ id: "1", syncId: "host1" }] },
  };
  const tabs = {
    onBeforeReady: vi.fn((fn) => {
      restore = fn;
      return () => {};
    }),
    onChange: vi.fn(() => () => {}),
    onReady: vi.fn((fn) => {
      ready = fn;
      return () => {};
    }),
    getLayout: vi.fn(),
    applyLayout: vi.fn(async (_layout: unknown, _options: unknown) => ({
      skipped: [],
    })),
    closeTab: vi.fn(),
    markRecoverable: vi.fn(() => () => {}),
    renameTab: vi.fn(),
    updateTabData: vi.fn(),
  };
  const app = {
    tabs,
    api: { get },
    registerAction: vi.fn(),
    registerSlotContribution: vi.fn((_slot, contribution) => {
      Controller = contribution.component;
    }),
    onDispose: (off: () => void) => disposers.push(off),
    t: (key: string) => key,
  };
  createSessionRecovery(app as never);
  render(<Controller />);
  return { tabs, restore, ready };
}
function seed(ids = ["i1"]) {
  writeCache("u1", {
    version: 1,
    selectedHost: "1",
    layout: {
      version: 2,
      tabs: ids.map((id, n) => ({
        slotId: `slot${n}`,
        sourceInstanceId: id,
        type: "terminal",
        label: "old",
        hostSyncId: "host1",
        data: { sessionsSessionId: "s1", tmuxSession: "old" },
      })),
    },
    links: Object.fromEntries(
      ids.map((id, n) => [
        `slot${n}`,
        { sessionId: "s1", hostId: 1, instanceId: id },
      ]),
    ),
  });
}

describe("Sessions startup coordinator", () => {
  it("warns and preserves views and the last valid copy when window cache is corrupt", async () => {
    seed();
    const previous = localStorage.getItem("sessions:recovery:v1:u1");
    sessionStorage.setItem("sessions:recovery:v1:u1", "broken");
    const { tabs, restore, ready } = start([
      { id: "old", instanceId: "i1", host: { id: "1" } },
    ]);
    await act(restore);
    await act(ready);
    window.dispatchEvent(new Event("pagehide"));
    expect(context.warning).toHaveBeenCalledWith("recovery.failed");
    expect(tabs.closeTab).not.toHaveBeenCalled();
    expect(tabs.applyLayout).not.toHaveBeenCalled();
    expect(tabs.updateTabData).toHaveBeenCalledWith("old", {
      sessionsSessionId: "s1",
    });
    expect(localStorage.getItem("sessions:recovery:v1:u1")).toBe(previous);
    expect(tabs.markRecoverable).not.toHaveBeenCalled();
  });
  it("initializes once when enabled after the shell is already ready", async () => {
    seed();
    const { tabs, ready, restore } = start([]);
    await act(ready);
    expect(tabs.applyLayout).toHaveBeenCalledTimes(1);
    await act(restore);
    expect(tabs.applyLayout).toHaveBeenCalledTimes(1);
  });
  it("clones the last layout into a new window without stealing another window's transport identity", async () => {
    seed();
    sessionStorage.clear();
    const { tabs, restore } = start([
      { id: "foreign", instanceId: "i1", host: { id: "1" } },
    ]);
    await act(restore);
    expect(tabs.closeTab).toHaveBeenCalledWith("foreign", {
      connectionAlreadyConfirmed: true,
      preserveSavedRecord: true,
    });
    expect(tabs.applyLayout.mock.calls[0][1]).toEqual({
      mode: "merge",
      existingTabs: {},
    });
  });
  it("reuses each distinct view and restores current names before terminals start", async () => {
    seed(["i1", "i2"]);
    const { tabs, restore } = start(
      ["i1", "i2"].map((id, i) => ({
        id: `t${i}`,
        instanceId: id,
        host: { id: "1" },
        data: { sessionsSessionId: "s1" },
      })),
    );
    await act(restore);
    expect(tabs.applyLayout.mock.calls[0][1]).toEqual({
      mode: "merge",
      existingTabs: { slot0: "t0", slot1: "t1" },
    });
    expect(
      (tabs.applyLayout.mock.calls[0][0] as any).tabs[0].data.tmuxSession,
    ).toBe("current");
  });
  it("closes a core-restored ended view rather than mounting it as ordinary SSH", async () => {
    seed();
    const { tabs, restore } = start(
      [{ id: "old", instanceId: "i1", host: { id: "1" } }],
      vi.fn(async () => ({
        data: { data: { id: "s1", hostId: 1, endedAt: "now" } },
      })) as never,
    );
    await act(restore);
    expect(tabs.closeTab).toHaveBeenCalledWith("old", {
      connectionAlreadyConfirmed: true,
    });
    expect((tabs.applyLayout.mock.calls[0][0] as any).tabs).toEqual([]);
  });
  it("retains a retryable identity on network error without using the old name", async () => {
    seed();
    const { tabs, restore } = start(
      [],
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    await act(restore);
    expect((tabs.applyLayout.mock.calls[0][0] as any).tabs[0].data).toEqual({
      sessionsSessionId: "s1",
    });
  });
  it("does not reopen another window's known Sessions view returned by core", async () => {
    seed(["other-window-instance"]);
    // New window has an explicit empty layout; global server records contain both windows.
    sessionStorage.setItem(
      "sessions:recovery:v1:u1",
      JSON.stringify({
        version: 1,
        selectedHost: "1",
        layout: { version: 2, tabs: [] },
        links: {},
      }),
    );
    const { tabs, restore } = start([
      { id: "foreign", instanceId: "other-window-instance", host: { id: "1" } },
    ]);
    await act(restore);
    expect(tabs.closeTab).toHaveBeenCalledWith("foreign", {
      connectionAlreadyConfirmed: true,
      preserveSavedRecord: true,
    });
  });
});
