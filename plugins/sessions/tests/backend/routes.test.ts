import path from "node:path";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createMockCtx,
  createTestDb,
  type TestDb,
} from "@termix-ssh/plugin-sdk/testing";
import manifest from "../../manifest.json" with { type: "json" };
import { sessions } from "../../src/backend/tables.js";
import { SessionRepository } from "../../src/backend/repository.js";
import { PersistentSessionLifecycleService } from "../../src/backend/lifecycle.js";
import { PersistentSessionError } from "../../src/backend/errors.js";
import { registerRoutes } from "../../src/backend/routes.js";
import type { RemotePersistentSession } from "../../src/backend/types.js";

const pluginDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** An in-memory stand-in for tmux on one host. */
function fakeGateway() {
  const remote = new Map<string, RemotePersistentSession>();
  const state = { down: false };
  const guard = () => {
    if (state.down)
      throw new PersistentSessionError("PERSISTENT_SESSION_REMOTE_UNAVAILABLE");
  };
  return {
    state,
    remote,
    async list() {
      guard();
      return [...remote.values()];
    },
    async create(
      _h: unknown,
      i: { name: string; id: string; createdAt: string },
    ) {
      guard();
      remote.set(i.name, {
        name: i.name,
        attachedClients: 0,
        marker: { id: i.id, createdAt: i.createdAt, expiryMode: "manual" },
      });
    },
    async mark() {},
    async rename(_h: unknown, i: { oldName: string; newName: string }) {
      guard();
      const s = remote.get(i.oldName)!;
      remote.delete(i.oldName);
      remote.set(i.newName, { ...s, name: i.newName });
    },
    async kill(_h: unknown, name: string) {
      guard();
      remote.delete(name);
    },
    async killUnguarded(_h: unknown, name: string) {
      guard();
      remote.delete(name);
    },
    async freeze() {},
    async thaw() {},
    async enableSyncOutput() {},
  };
}

let testDb: TestDb;
let server: ReturnType<typeof app.listen>;
let app: express.Express;
let base = "";
let actor = "u1";
let gw: ReturnType<typeof fakeGateway>;
let repo: SessionRepository;

beforeEach(async () => {
  testDb = await createTestDb(pluginDir);
  testDb.sqlite.exec(
    "INSERT INTO users (id, username) VALUES ('u1','one'),('u2','two')",
  );
  testDb.sqlite.exec("INSERT INTO ssh_data (id) VALUES (1),(2)");
  const mock = createMockCtx({
    pluginId: manifest.id,
    manifest: manifest as never,
    capabilities: manifest.capabilities,
    db: testDb.database,
  });
  const table = await mock.ctx.db.define(sessions);
  repo = new SessionRepository(
    (await mock.ctx.db.client()) as never,
    table as never,
    () => mock.ctx.db.persist(),
  );
  gw = fakeGateway();
  const lifecycle = new PersistentSessionLifecycleService(
    repo,
    gw as never,
    async (id) => (id === 1 || id === 2 ? { id } : null),
  );
  app = express();
  app.use(express.json());
  const router = express.Router();
  registerRoutes(router, {
    lifecycle,
    repository: repo,
    reconcile: async () => ({ hosts: [] }),
    actor: () => actor,
    guard: () => (_req, _res, next) => next(),
    canAccessHost: async (id) => id === 1 || id === 2,
  });
  app.use("/", router);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  testDb.close();
  actor = "u1";
});

const j = (method: string, url: string, body?: unknown) =>
  fetch(base + url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("routes", () => {
  it("creates, lists, renames and terminates a session", async () => {
    const created = await j("POST", "/", {
      hostId: 1,
      displayName: "Work",
      tmuxSessionName: "work",
    });
    expect(created.status).toBe(201);
    const { data } = await created.json();
    expect(gw.remote.has("work")).toBe(true);

    const list = await (await j("GET", "/")).json();
    expect(list.data.map((r: { id: string }) => r.id)).toEqual([data.id]);
    expect(list.meta).toMatchObject({ total: 1 });

    const renamed = await (
      await j("PATCH", `/${data.id}`, {
        displayName: "Work 2",
        tmuxSessionName: "work2",
      })
    ).json();
    expect(renamed.data).toMatchObject({
      displayName: "Work 2",
      tmuxSessionName: "work2",
    });
    expect(gw.remote.has("work2")).toBe(true);

    const killed = await (await j("DELETE", `/${data.id}`)).json();
    expect(killed.data.endReason).toBe("killed");
    expect(gw.remote.size).toBe(0);
  });

  it("answers a conflict with the error envelope", async () => {
    await j("POST", "/", {
      hostId: 1,
      displayName: "A",
      tmuxSessionName: "same",
    });
    const again = await j("POST", "/", {
      hostId: 1,
      displayName: "B",
      tmuxSessionName: "same",
    });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("PERSISTENT_SESSION_CONFLICT");
  });

  it("keeps other users' sessions invisible", async () => {
    const { data } = await (
      await j("POST", "/", {
        hostId: 1,
        displayName: "A",
        tmuxSessionName: "mine",
      })
    ).json();
    actor = "u2";
    expect((await j("GET", `/${data.id}`)).status).toBe(404);
    expect((await (await j("GET", "/")).json()).data).toEqual([]);
  });

  it("force-removes the record when the host is unreachable, but not without force", async () => {
    const { data } = await (
      await j("POST", "/", {
        hostId: 1,
        displayName: "A",
        tmuxSessionName: "x",
      })
    ).json();
    gw.state.down = true;
    expect((await j("DELETE", `/${data.id}`)).status).toBe(503);
    const forced = await j("DELETE", `/${data.id}?force=true`);
    expect(forced.status).toBe(200);
    expect((await forced.json()).data.endReason).toBe("killed-unreachable");
  });

  it("imports exported rows as the caller, ignoring the userId in the body", async () => {
    const rows = [
      {
        id: "old-1",
        userId: "u2",
        hostId: 1,
        displayName: "Old",
        tmuxSessionName: "old",
        managementState: "managed",
        expiryMode: "manual",
      },
    ];
    const res = await j("POST", "/import", { sessions: rows });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      imported: 1,
      skipped: 0,
      rejected: 0,
    });
    expect((await repo.findByIdForUser("old-1", "u1"))?.id).toBe("old-1");
    expect(await repo.findByIdForUser("old-1", "u2")).toBeNull();
    const again = await (await j("POST", "/import", { sessions: rows })).json();
    expect(again.data).toEqual({ imported: 0, skipped: 1, rejected: 0 });
  });

  it("rejects imported rows for hosts the caller cannot use", async () => {
    const rows = [
      {
        id: "bad",
        userId: "u1",
        hostId: 99,
        displayName: "X",
        tmuxSessionName: "x",
        managementState: "managed",
        expiryMode: "manual",
      },
    ];
    const res = await (await j("POST", "/import", { sessions: rows })).json();
    expect(res.data).toEqual({ imported: 0, skipped: 0, rejected: 1 });
  });
});
