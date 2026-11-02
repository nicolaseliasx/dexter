import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createMockCtx } from "@termix-ssh/plugin-sdk/testing";
import manifest from "../../manifest.json" with { type: "json" };
import { activate } from "../../src/backend/index.js";

const TOKEN = "secret-token-0123456789abcdef0123456789";
let server: ReturnType<express.Express["listen"]> | undefined;
afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

async function boot(settings: Record<string, unknown>) {
  let router: express.Router | null = null;
  const mock = createMockCtx({
    pluginId: manifest.id,
    manifest: manifest as never,
    capabilities: manifest.capabilities,
    router: () => (router = express.Router()),
    permissions: ["dexter-ops.manage"],
    settings,
    fetch: async () => Response.json({ api_version: 1, bot_version: "0.6.0" }),
  });
  await activate(mock.ctx);
  const app = express();
  app.use(express.json());
  app.use("/api", router!);
  await new Promise<void>((resolve) => (server = app.listen(0, () => resolve())));
  return { mock, base: `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api` };
}

describe("manifest", () => {
  it("asks for the minimum: outbound HTTP, its own routes and a panel", () => {
    expect([...manifest.capabilities].sort()).toEqual(["network:outbound", "network:serve", "ui:surface"]);
    expect(manifest.contributes.permissions).toEqual([expect.objectContaining({ name: "manage", defaultRoles: ["admin"] })]);
    const token = manifest.contributes.settings.admin.find((s) => s.key === "token");
    expect(token?.type).toBe("secret");
  });
});

describe("activate", () => {
  it("serves the proxy behind manage and reaches only the configured host", async () => {
    const { mock, base } = await boot({ botUrl: "http://172.17.0.1:8787", token: TOKEN });
    const res = await fetch(`${base}/status`);
    expect(await res.json()).toMatchObject({ compatible: true, bot_version: "0.6.0" });
    expect(mock.fetches).toHaveLength(1);
    expect(mock.fetches[0].url).toBe("http://172.17.0.1:8787/v1/status");
    expect(mock.fetches[0].init?.allowPrivateHosts).toEqual(["172.17.0.1"]);
    expect(mock.checked).toEqual(expect.arrayContaining(["network:outbound"]));
  });

  it("records an audit line for every policy change, without the token", async () => {
    const { mock, base } = await boot({ botUrl: "http://127.0.0.1:8787", token: TOKEN });
    await fetch(`${base}/ops/restart-nginx`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(mock.audits).toEqual([expect.objectContaining({ action: "dexter-ops.op.disable", resourceId: "restart-nginx", success: true })]);
    expect(JSON.stringify(mock.audits)).not.toContain(TOKEN);
  });

  it("answers 409 until the bot is configured", async () => {
    const { mock, base } = await boot({});
    const res = await fetch(`${base}/status`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: "NOT_CONFIGURED" } });
    expect(mock.fetches).toHaveLength(0);
  });
});
