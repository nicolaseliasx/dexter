import type { Request, RequestHandler, Response, Router } from "express";
import { BotError, type BotRequest } from "./client.js";

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  errorMessage?: string;
}

export interface RouteDeps {
  bot: BotRequest;
  audit: (entry: AuditEntry) => Promise<void>;
  guard: () => RequestHandler;
}

/** Same shape the bot validates for operation ids. */
const OP_ID = /^[a-z0-9_-]{1,32}$/;
const ALERT_ID = /^[0-9]{1,12}$/;
const API_VERSION = 1;

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function fail(res: Response, error: unknown): void {
  const e = error instanceof BotError ? error : new BotError("INTERNAL", 500);
  res.status(e.status).json({ error: { code: e.code } });
}

/** Body is exactly `{ [key]: boolean }`; anything else is refused before reaching the bot. */
function strictBool(body: unknown, key: string): boolean | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const keys = Object.keys(body);
  const value = (body as Record<string, unknown>)[key];
  return keys.length === 1 && keys[0] === key && typeof value === "boolean" ? value : undefined;
}

/**
 * Every route is an explicit allowlist entry: there is no generic proxy, no route that
 * changes the bot's policy, and none that runs a command. Writes are audited.
 */
export function registerRoutes(router: Router, deps: RouteDeps): void {
  router.use(deps.guard());

  const read = (route: string, upstream: (req: Request) => string, shape?: (data: unknown) => unknown) => {
    router.get(route, async (req, res) => {
      try {
        const data = await deps.bot("GET", upstream(req));
        res.json(shape ? shape(data) : data);
      } catch (error) {
        fail(res, error);
      }
    });
  };

  read("/status", () => "/v1/status", (data) => {
    const status = (data ?? {}) as Record<string, unknown>;
    return { ...status, compatible: status.api_version === API_VERSION };
  });
  read("/hosts", () => "/v1/hosts");
  read("/policy", () => "/v1/policy");
  read("/ops", () => "/v1/ops");
  read("/alerts", () => "/v1/alerts");
  read("/notifications", () => "/v1/notifications");
  read("/history", (req) => {
    const n = Number(req.query.limit);
    const limit = Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), 100) : 50;
    return `/v1/history?limit=${limit}`;
  });

  const write = async (
    res: Response,
    action: string,
    resourceType: string,
    resourceId: string | undefined,
    call: () => Promise<unknown>,
    status = 200,
  ) => {
    try {
      const data = await call();
      await deps.audit({ action, resourceType, resourceId, success: true });
      res.status(status).json(data);
    } catch (error) {
      const code = error instanceof BotError ? error.code : "INTERNAL";
      await deps.audit({ action, resourceType, resourceId, success: false, errorMessage: code }).catch(() => undefined);
      fail(res, error);
    }
  };

  router.put("/ops/:id", async (req, res) => {
    const id = param(req, "id");
    const enabled = strictBool(req.body, "enabled");
    if (!OP_ID.test(id) || enabled === undefined) return void res.status(400).json({ error: { code: "BAD_REQUEST" } });
    await write(res, `dexter-ops.op.${enabled ? "enable" : "disable"}`, "operation", id, () =>
      deps.bot("PUT", `/v1/ops/${id}`, { enabled }),
    );
  });

  router.post("/ops/:id/request", async (req, res) => {
    const id = param(req, "id");
    if (!OP_ID.test(id)) return void res.status(400).json({ error: { code: "BAD_REQUEST" } });
    await write(res, "dexter-ops.op.request", "operation", id, () => deps.bot("POST", `/v1/ops/${id}/request`), 202);
  });

  router.put("/notifications", async (req, res) => {
    const muted = strictBool(req.body, "muted");
    if (muted === undefined) return void res.status(400).json({ error: { code: "BAD_REQUEST" } });
    await write(res, `dexter-ops.notifications.${muted ? "mute" : "unmute"}`, "notifications", undefined, () =>
      deps.bot("PUT", "/v1/notifications", { muted }),
    );
  });

  router.post("/alerts/:id/ack", async (req, res) => {
    const id = param(req, "id");
    if (!ALERT_ID.test(id)) return void res.status(400).json({ error: { code: "BAD_REQUEST" } });
    await write(res, "dexter-ops.alert.ack", "alert", id, () => deps.bot("POST", `/v1/alerts/${id}/ack`));
  });
}
