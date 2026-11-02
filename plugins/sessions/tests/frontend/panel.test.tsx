import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithApp } from "@termix-ssh/plugin-sdk/testing";
import * as plugin from "../../src/frontend/index.js";
import en from "../../locales/en.json";
import manifest from "../../manifest.json" with { type: "json" };

const session = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  hostId: 1,
  displayName: "Work",
  tmuxSessionName: "work",
  hibernatedAt: null,
  endedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

function api(sessions = [session()]) {
  return {
    get: vi.fn(async () => ({ data: { data: sessions, meta: { total: sessions.length, limit: 50, offset: 0 } } })),
    post: vi.fn(async () => ({ data: { data: session({ id: "new", displayName: "Fresh", tmuxSessionName: "fresh" }) } })),
    patch: vi.fn(async () => ({ data: { data: session() } })),
    put: vi.fn(),
    delete: vi.fn(async () => ({ data: { data: session({ endedAt: "x" }) } })),
  };
}

const hosts = [{ id: "1", name: "devhub", ip: "10.0.0.1", port: 22 }];

describe("sessions frontend", () => {
  it("registers a rail item gated on use and a panel", async () => {
    const app = await renderWithApp(plugin as never, { pluginId: manifest.id, manifest: manifest as never, hosts, locales: en, api: api() as never });
    expect(app.registered.railItems().map((r) => r.id)).toContain("sessions");
    expect(app.registered.panels()).toContain("sessions");
  });

  it("lists sessions and Attach opens the official terminal inside that tmux session", async () => {
    const stub = api();
    const app = await renderWithApp(plugin as never, { pluginId: manifest.id, manifest: manifest as never, hosts, locales: en, api: stub as never });
    app.renderPanel("sessions");
    const attach = await screen.findByRole("button", { name: /attach/i });
    fireEvent.click(attach);
    await waitFor(() => expect(app.shellCalls.some((c) => c.method === "openTab")).toBe(true));
    const call = app.shellCalls.find((c) => c.method === "openTab")!;
    expect(call.args[1]).toBe("terminal");
    expect(call.args[2]).toMatchObject({ data: { tmuxSession: "work" } });
  });

  it("creates a session on the chosen host and opens it", async () => {
    const stub = api([]);
    const app = await renderWithApp(plugin as never, { pluginId: manifest.id, manifest: manifest as never, hosts, locales: en, api: stub as never });
    app.renderPanel("sessions");
    const name = await screen.findByPlaceholderText(/codex-termix/i);
    fireEvent.change(name, { target: { value: "fresh" } });
    fireEvent.click(screen.getByRole("button", { name: /create session/i }));
    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const body = (stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(body).toMatchObject({ hostId: 1, tmuxSessionName: "fresh", displayName: "fresh" });
    await waitFor(() => expect(app.shellCalls.some((c) => c.method === "openTab")).toBe(true));
  });
});
