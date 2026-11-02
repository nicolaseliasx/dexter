import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BotError } from "../../src/backend/client.js";
import { registerRoutes } from "../../src/backend/routes.js";

type Audit = { action: string; resourceId?: string; success: boolean };
let server: ReturnType<express.Express["listen"]>;
let base = "";
let botCalls: { method: string; path: string; body?: unknown }[] = [];
let audits: Audit[] = [];
let guarded = 0;
let botReply: (method: string, path: string) => unknown = () => ({ ok: true });

beforeEach(async () => {
  botCalls = [];
  audits = [];
  guarded = 0;
  botReply = () => ({ ok: true });
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerRoutes(router, {
    bot: (async (method: string, path: string, body?: unknown) => {
      botCalls.push({ method, path, body });
      const out = botReply(method, path);
      if (out instanceof BotError) throw out;
      return out;
    }) as never,
    audit: async (entry) => void audits.push(entry),
    guard: () => (_req, _res, next) => {
      guarded += 1;
      next();
    },
  });
  app.use("/api", router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

const send = (method: string, path: string, body?: unknown) =>
  fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("read routes", () => {
  it("proxy only the allowlisted GET endpoints, behind the guard", async () => {
    for (const [route, upstream] of [
      ["/status", "/v1/status"],
      ["/hosts", "/v1/hosts"],
      ["/policy", "/v1/policy"],
      ["/ops", "/v1/ops"],
      ["/alerts", "/v1/alerts"],
      ["/notifications", "/v1/notifications"],
      ["/history", "/v1/history?limit=50"],
    ] as const) {
      botCalls = [];
      const res = await send("GET", route);
      expect(res.status, route).toBe(200);
      expect(botCalls).toEqual([{ method: "GET", path: upstream, body: undefined }]);
    }
    expect(guarded).toBe(7);
    expect((await send("GET", "/v1/status")).status).toBe(404);
    expect((await send("GET", "/anything-else")).status).toBe(404);
  });

  it("marks the bot as compatible only when it speaks API version 1", async () => {
    botReply = () => ({ api_version: 1, bot_version: "0.6.0" });
    expect(await (await send("GET", "/status")).json()).toMatchObject({ compatible: true, api_version: 1 });
    botReply = () => ({ api_version: 2 });
    expect(await (await send("GET", "/status")).json()).toMatchObject({ compatible: false });
    botReply = () => ({ bot_version: "0.5.3" });
    expect(await (await send("GET", "/status")).json()).toMatchObject({ compatible: false });
  });

  it("clamps the history limit", async () => {
    await send("GET", "/history?limit=9999");
    await send("GET", "/history?limit=abc");
    expect(botCalls.map((c) => c.path)).toEqual(["/v1/history?limit=100", "/v1/history?limit=50"]);
  });

  it("turns bot errors into a stable JSON error", async () => {
    botReply = () => new BotError("BOT_UNREACHABLE", 502);
    const res = await send("GET", "/status");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: { code: "BOT_UNREACHABLE" } });
  });
});

describe("write routes", () => {
  it("toggles an operation, validates the input and audits the change", async () => {
    const ok = await send("PUT", "/ops/restart-nginx", { enabled: false });
    expect(ok.status).toBe(200);
    expect(botCalls).toEqual([{ method: "PUT", path: "/v1/ops/restart-nginx", body: { enabled: false } }]);
    expect(audits).toEqual([expect.objectContaining({ action: "dexter-ops.op.disable", resourceId: "restart-nginx", success: true })]);

    botCalls = [];
    for (const [id, body] of [
      ["restart-nginx", { enabled: "yes" }],
      ["restart-nginx", { enabled: true, extra: 1 }],
      ["restart-nginx", {}],
      ["UPPER", { enabled: true }],
      ["a".repeat(33), { enabled: true }],
      ["..%2Fx", { enabled: true }],
    ] as const) {
      expect((await send("PUT", `/ops/${id}`, body)).status, `${id} ${JSON.stringify(body)}`).toBe(400);
    }
    expect(botCalls).toHaveLength(0);
  });

  it("audits a failed attempt too", async () => {
    botReply = () => new BotError("NOT_FOUND", 404);
    const res = await send("PUT", "/ops/nope", { enabled: true });
    expect(res.status).toBe(404);
    expect(audits).toEqual([expect.objectContaining({ action: "dexter-ops.op.enable", resourceId: "nope", success: false })]);
  });

  it("requests an operation without a body and audits it", async () => {
    botReply = () => ({ id: "restart-nginx", status: "awaiting_confirmation" });
    const res = await send("POST", "/ops/restart-nginx/request");
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ status: "awaiting_confirmation" });
    expect(botCalls).toEqual([{ method: "POST", path: "/v1/ops/restart-nginx/request", body: undefined }]);
    expect(audits[0]).toMatchObject({ action: "dexter-ops.op.request", resourceId: "restart-nginx", success: true });
  });

  it("mutes notifications and acknowledges alerts with strict input", async () => {
    expect((await send("PUT", "/notifications", { muted: true })).status).toBe(200);
    expect((await send("PUT", "/notifications", { muted: "x" })).status).toBe(400);
    expect((await send("POST", "/alerts/7/ack")).status).toBe(200);
    expect((await send("POST", "/alerts/abc/ack")).status).toBe(400);
    expect((await send("POST", "/alerts/1.5/ack")).status).toBe(400);
    expect(botCalls.map((c) => `${c.method} ${c.path}`)).toEqual(["PUT /v1/notifications", "POST /v1/alerts/7/ack"]);
    expect(audits.map((a) => a.action)).toEqual(["dexter-ops.notifications.mute", "dexter-ops.alert.ack"]);
  });

  it("has no route that changes the policy or runs a command", async () => {
    for (const [m, p] of [["PUT", "/policy"], ["POST", "/exec"], ["POST", "/ops"], ["DELETE", "/ops/restart-nginx"]] as const) {
      expect((await send(m, p, {})).status, `${m} ${p}`).toBe(404);
    }
  });
});
