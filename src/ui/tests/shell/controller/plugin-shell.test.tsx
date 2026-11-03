import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { ShellController as PluginShell } from "@termix-ssh/plugin-sdk/frontend";

vi.mock("@/main-axios", () => ({
  getUserInfo: vi.fn(async () => ({ is_admin: false })),
  getUserPreferences: vi.fn(async () => ({ reopenTabsOnLogin: false })),
  saveUserPreferences: vi.fn(async () => {}),
  getSSHHosts: vi.fn(async () => []),
  getSSHFolders: vi.fn(async () => []),
  getOpenTabs: vi.fn(async () => []),
  getActiveSessions: vi.fn(async () => []),
  addOpenTab: vi.fn(async () => {}),
  deleteOpenTab: vi.fn(async () => {}),
  patchOpenTab: vi.fn(async () => {}),
  createSSHHost: vi.fn(async () => ({})),
}));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    permissions: ["hosts.view"],
    isAdmin: false,
    loaded: true,
    has: () => true,
  }),
}));

import { ShellControllerProvider } from "@/shell/controller/ShellControllerProvider";
import { usePluginShell } from "@/shell/controller/plugin-shell";
import { registerTabType, resetTabTypes } from "@/shell/tab-registry";
import { markPluginsSettled } from "@/plugin-host/plugin-store";

afterEach(async () => {
  cleanup();
  resetTabTypes();
  vi.restoreAllMocks();
  const api = await import("@/main-axios");
  vi.mocked(api.getSSHHosts).mockResolvedValue([]);
  vi.mocked(api.getOpenTabs).mockResolvedValue([]);
  vi.mocked(api.getUserPreferences).mockResolvedValue({
    reopenTabsOnLogin: false,
  } as never);
});

let shell: PluginShell | null = null;
function Capture() {
  shell = usePluginShell("my-layout");
  return null;
}

describe("usePluginShell", () => {
  it("gives restored tabs distinct live IDs even when saved ordering and clock ticks collide", async () => {
    const api = await import("@/main-axios");
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.mocked(api.getSSHHosts).mockResolvedValue([
      { id: "1", name: "host", syncId: "h1" },
    ] as never);
    vi.mocked(api.getUserPreferences).mockResolvedValue({
      reopenTabsOnLogin: true,
    } as never);
    vi.mocked(api.getOpenTabs).mockResolvedValue(
      ["a", "b", "c"].map((id) => ({
        id,
        hostId: 1,
        tabType: "terminal",
        label: id,
        tabOrder: 0,
        createdAt: "2026-01-01T00:00:00Z",
      })) as never,
    );
    markPluginsSettled();
    registerTabType({
      id: "terminal",
      component: () => null,
      persistent: true,
    });
    render(
      <ShellControllerProvider username="ada" onLogout={() => {}}>
        <Capture />
      </ShellControllerProvider>,
    );
    await waitFor(() => expect(shell?.tabs.ready).toBe(true));
    const tabs = shell!.tabs.list.filter((tab) => tab.type === "terminal");
    expect(tabs.map((tab) => tab.instanceId)).toEqual(["a", "b", "c"]);
    expect(new Set(tabs.map((tab) => tab.id)).size).toBe(3);
    vi.mocked(api.getSSHHosts).mockResolvedValue([]);
    vi.mocked(api.getOpenTabs).mockResolvedValue([]);
    vi.mocked(api.getUserPreferences).mockResolvedValue({
      reopenTabsOnLogin: false,
    } as never);
  });
  it("drops another window's unmounted restored view without deleting its saved record", async () => {
    const api = await import("@/main-axios");
    vi.mocked(api.deleteOpenTab).mockClear();
    registerTabType({
      id: "terminal",
      component: () => null,
      persistent: true,
    });
    render(
      <ShellControllerProvider username="ada" onLogout={() => {}}>
        <Capture />
      </ShellControllerProvider>,
    );
    await waitFor(() => expect(shell).not.toBeNull());
    act(() =>
      shell!.actions.openTab({ id: "1", name: "host" } as never, "terminal"),
    );
    await waitFor(() =>
      expect(shell!.tabs.list.some((tab) => tab.type === "terminal")).toBe(
        true,
      ),
    );
    const tab = shell!.tabs.list.find((tab) => tab.type === "terminal")!;
    await act(async () => {
      shell!.actions.closeTab(tab.id, {
        connectionAlreadyConfirmed: true,
        preserveSavedRecord: true,
      });
    });
    expect(api.deleteOpenTab).not.toHaveBeenCalled();
  });
  it("gives a layout the live shell", async () => {
    render(
      <ShellControllerProvider username="ada" onLogout={() => {}}>
        <Capture />
      </ShellControllerProvider>,
    );
    await waitFor(() => expect(shell).not.toBeNull());
    expect(shell!.env).toMatchObject({
      user: { username: "ada", isAdmin: false },
      permissions: ["hosts.view"],
      isElectron: false,
    });
    expect(shell!.tabs.activeId).toBe("dashboard");
    expect(typeof shell!.registries.useRailItems).toBe("function");

    act(() => shell!.actions.openSingletonTab("settings"));
    await waitFor(() => expect(shell!.tabs.activeId).toBe("settings"));

    act(() => shell!.regions.railClick("credentials"));
    expect(shell!.regions.left).toMatchObject({
      view: "credentials",
      open: true,
    });

    act(() => shell!.palette.open());
    expect(shell!.palette.isOpen).toBe(true);
  });

  it("hides the home tab from a layout that gives it no tab type", async () => {
    render(
      <ShellControllerProvider username="ada" onLogout={() => {}}>
        <Capture />
      </ShellControllerProvider>,
    );
    await waitFor(() => expect(shell).not.toBeNull());
    expect(shell!.tabs.list.map((tab) => tab.type)).not.toContain("dashboard");
    expect(shell!.tabs.topLevel).toEqual([]);

    act(() => {
      registerTabType({ id: "dashboard", component: () => null });
    });
    await waitFor(() =>
      expect(shell!.tabs.topLevel.map((tab) => tab.id)).toEqual(["dashboard"]),
    );
  });
});
