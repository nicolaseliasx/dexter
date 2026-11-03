import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readCache,
  writeCache,
  synchronizeSession,
  getSession,
} from "../../src/frontend/recovery.js";

const row = {
  id: "s1",
  hostId: 1,
  displayName: "Renamed",
  tmuxSessionName: "renamed",
  endedAt: null,
};
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("browser session recovery", () => {
  it("keeps a live window independent from the last saved layout", () => {
    const first = {
      version: 1 as const,
      layout: { version: 2, tabs: [], activeSlotId: null },
      links: {},
      selectedHost: "1",
    };
    expect(writeCache("u1", first)).toBe(true);
    localStorage.setItem(
      "sessions:recovery:v1:u1",
      JSON.stringify({ ...first, selectedHost: "2" }),
    );
    expect(readCache("u1")?.selectedHost).toBe("1");
    sessionStorage.clear();
    expect(readCache("u1")?.selectedHost).toBe("2");
    expect(readCache("u2")).toBeNull();
  });
  it("rejects corrupt cache and reports storage failure", () => {
    sessionStorage.setItem("sessions:recovery:v1:u1", "broken");
    expect(readCache("u1")).toBeNull();
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    expect(
      writeCache("u1", {
        version: 1,
        layout: { version: 2, tabs: [] },
        links: {},
        selectedHost: "",
      }),
    ).toBe(false);
    spy.mockRestore();
  });
  it("renames every view and updates reconnect data, never touches another host or session", () => {
    const tabs = [
      {
        id: "a",
        host: { id: "1" },
        data: { sessionsSessionId: "s1", tmuxSession: "old" },
      },
      { id: "b", host: { id: "1" }, data: { sessionsSessionId: "s1" } },
      { id: "c", host: { id: "2" }, data: { sessionsSessionId: "s1" } },
    ];
    const api = {
      renameTab: vi.fn(),
      updateTabData: vi.fn(),
      closeTab: vi.fn(),
    };
    synchronizeSession(row as never, tabs as never, api as never);
    expect(api.renameTab.mock.calls).toEqual([
      ["a", "Renamed"],
      ["b", "Renamed"],
    ]);
    expect(api.updateTabData).toHaveBeenCalledWith("a", {
      sessionsSessionId: "s1",
      tmuxSession: "renamed",
    });
    expect(api.closeTab).not.toHaveBeenCalled();
    synchronizeSession(
      { ...row, endedAt: "now" } as never,
      tabs as never,
      api as never,
    );
    expect(api.closeTab.mock.calls).toEqual([
      ["a", { connectionAlreadyConfirmed: true }],
      ["b", { connectionAlreadyConfirmed: true }],
    ]);
  });
  it("resolves the current name by id and refuses ended or mismatched sessions", async () => {
    const api = { get: vi.fn(async () => ({ data: { data: row } })) };
    expect(await getSession(api as never, "s1", 1)).toMatchObject({
      tmuxSessionName: "renamed",
    });
    await expect(getSession(api as never, "s1", 2)).rejects.toThrow();
    api.get.mockResolvedValue({
      data: { data: { ...row, endedAt: "now" } },
    } as never);
    await expect(getSession(api as never, "s1", 1)).rejects.toThrow();
  });
});
