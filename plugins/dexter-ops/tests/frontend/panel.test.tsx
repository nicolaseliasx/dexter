import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithApp } from "@termix-ssh/plugin-sdk/testing";
import * as plugin from "../../src/frontend/index.js";
import en from "../../locales/en.json";
import manifest from "../../manifest.json" with { type: "json" };

const status = (over: Record<string, unknown> = {}) => ({
  api_version: 1,
  compatible: true,
  bot_version: "0.6.0",
  uptime_secs: 3700,
  watch_enabled: true,
  notifications_muted: false,
  last_collect_at: 1000,
  hosts_total: 1,
  hosts_down: 0,
  active_alerts: 1,
  ...over,
});

const data = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  "/status": status(),
  "/hosts": { hosts: [{ id: "devhub", name: "DevHub", state: "up", checked_at: 1000 }] },
  "/policy": { read_only: true, hosts: [{ id: "devhub", name: "DevHub", read_roots: ["/etc"], log_roots: ["/var/log"], services: ["nginx"], sudo_commands: [] }] },
  "/ops": {
    ops: [
      { id: "restart-nginx", name: "Restart nginx", host: "devhub", description: "", destructive: true, enabled: true },
      { id: "list-backups", name: "List backups", host: "devhub", description: "", destructive: false, enabled: true },
    ],
  },
  "/alerts": { alerts: [{ id: 7, key: "disk", active: true, severity: "crit", text: "Disk / at 97%", since: 900, acked: false }] },
  "/history": { entries: [{ ts: 1000, host: "devhub", action: "api", detail: "op-disable restart-nginx", decision: "allowed", exit: null, duration_ms: null }] },
  ...over,
});

function api(replies = data()) {
  return {
    get: vi.fn(async (path: string) => {
      const reply = replies[path.split("?")[0]];
      if (reply instanceof Error) throw reply;
      return { data: reply };
    }),
    post: vi.fn(async () => ({ data: { status: "awaiting_confirmation" } })),
    put: vi.fn(async () => ({ data: {} })),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

const boot = async (stub: ReturnType<typeof api>) => {
  const app = await renderWithApp(plugin as never, { pluginId: manifest.id, manifest: manifest as never, locales: en, api: stub as never });
  app.renderPanel("dexter-ops");
  return app;
};

describe("dexter-ops frontend", () => {
  it("registers a rail item gated on manage and a panel", async () => {
    const app = await renderWithApp(plugin as never, { pluginId: manifest.id, manifest: manifest as never, locales: en, api: api() as never });
    expect(app.registered.railItems().map((r) => r.id)).toContain("dexter-ops");
    expect(app.registered.panels()).toContain("dexter-ops");
  });

  it("shows the bot status, hosts, operations and alerts", async () => {
    await boot(api());
    expect(await screen.findByText(/0\.6\.0/)).toBeTruthy();
    expect(screen.getAllByText("DevHub").length).toBeGreaterThan(0);
    expect(screen.getByText("Restart nginx")).toBeTruthy();
    expect(screen.getByText("Disk / at 97%")).toBeTruthy();
  });

  it("turns an operation off with a PUT", async () => {
    const stub = api();
    await boot(stub);
    const toggle = await screen.findByRole("switch", { name: /restart nginx/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(stub.put).toHaveBeenCalledWith("/ops/restart-nginx", { enabled: false }));
  });

  it("asks before requesting a destructive operation and says the confirmation is in Telegram", async () => {
    const stub = api();
    await boot(stub);
    fireEvent.click(await screen.findByRole("button", { name: /request restart nginx/i }));
    expect(screen.getByText(/confirm.*in telegram/i)).toBeTruthy();
    expect(stub.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /send to telegram/i }));
    await waitFor(() => expect(stub.post).toHaveBeenCalledWith("/ops/restart-nginx/request"));
  });

  it("acknowledges an alert", async () => {
    const stub = api();
    await boot(stub);
    fireEvent.click(await screen.findByRole("button", { name: /acknowledge/i }));
    await waitFor(() => expect(stub.post).toHaveBeenCalledWith("/alerts/7/ack"));
  });

  it("mutes notifications", async () => {
    const stub = api();
    await boot(stub);
    fireEvent.click(await screen.findByRole("switch", { name: /mute notifications/i }));
    await waitFor(() => expect(stub.put).toHaveBeenCalledWith("/notifications", { muted: true }));
  });

  it("warns about an incompatible bot and offers no controls", async () => {
    const stub = api(data({ "/status": status({ api_version: 2, compatible: false }) }));
    await boot(stub);
    expect(await screen.findByText(/not compatible/i)).toBeTruthy();
    expect(screen.queryByRole("switch", { name: /restart nginx/i })).toBeNull();
  });

  it("explains how to configure the plugin when it is not set up", async () => {
    const err = Object.assign(new Error("conflict"), { response: { data: { error: { code: "NOT_CONFIGURED" } } } });
    await boot(api(data({ "/status": err })));
    expect(await screen.findByText(/set the bot address and token/i)).toBeTruthy();
  });
});
