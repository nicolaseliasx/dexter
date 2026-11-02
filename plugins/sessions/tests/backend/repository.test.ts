import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockCtx, createTestDb, type TestDb } from "@termix-ssh/plugin-sdk/testing";
import manifest from "../../manifest.json" with { type: "json" };
import { sessions } from "../../src/backend/tables.js";
import { SessionRepository } from "../../src/backend/repository.js";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let testDb: TestDb;
let repo: SessionRepository;

async function make() {
  testDb = await createTestDb(pluginDir);
  testDb.sqlite.exec("INSERT INTO users (id, username) VALUES ('u1','one'),('u2','two')");
  testDb.sqlite.exec("INSERT INTO ssh_data (id) VALUES (1),(2)");
  const mock = createMockCtx({
    pluginId: manifest.id,
    manifest: manifest as never,
    capabilities: manifest.capabilities,
    db: testDb.database,
  });
  const table = await mock.ctx.db.define(sessions);
  const db = await mock.ctx.db.client();
  repo = new SessionRepository(db as never, table as never, () => mock.ctx.db.persist());
}

const base = {
  userId: "u1",
  hostId: 1,
  displayName: "Work",
  tmuxSessionName: "work",
  managementState: "managed" as const,
  expiryMode: "manual" as const,
};

describe("SessionRepository", () => {
  beforeEach(make);
  afterEach(() => testDb.close());

  it("creates a session and finds it for its owner only", async () => {
    const row = await repo.create({ id: "s1", ...base });
    expect(row.id).toBe("s1");
    expect(await repo.findByIdForUser("s1", "u1")).toMatchObject({ tmuxSessionName: "work" });
    expect(await repo.findByIdForUser("s1", "u2")).toBeNull();
    expect(testDb.persisted).toBeGreaterThan(0);
  });

  it("refuses a second active session with the same host and tmux name", async () => {
    await repo.create({ id: "s1", ...base });
    await expect(repo.create({ id: "s2", ...base })).rejects.toThrow("PERSISTENT_SESSION_CONFLICT");
    await repo.create({ id: "s3", ...base, hostId: 2 });
  });

  it("allows the name again once the first session ended", async () => {
    await repo.create({ id: "s1", ...base });
    await repo.markEnded("s1", "u1", "killed");
    await repo.create({ id: "s2", ...base });
    const { data } = await repo.listByUser("u1");
    expect(data.map((r) => r.id)).toEqual(["s2"]);
    const all = await repo.listByUser("u1", { includeEnded: true });
    expect(all.total).toBe(2);
  });

  it("renames within a host and rejects a clash with another active session", async () => {
    await repo.create({ id: "s1", ...base });
    await repo.create({ id: "s2", ...base, tmuxSessionName: "other", displayName: "Other" });
    const renamed = await repo.update("s1", "u1", { displayName: "Work 2", tmuxSessionName: "work2" });
    expect(renamed).toMatchObject({ displayName: "Work 2", tmuxSessionName: "work2" });
    await expect(repo.update("s1", "u1", { tmuxSessionName: "other" })).rejects.toThrow("PERSISTENT_SESSION_CONFLICT");
  });

  it("marks hibernation and clears it", async () => {
    await repo.create({ id: "s1", ...base });
    const frozen = await repo.setHibernatedAt("s1", "u1", "2026-11-02T00:00:00.000Z");
    expect(frozen?.hibernatedAt).toBe("2026-11-02T00:00:00.000Z");
    expect((await repo.setHibernatedAt("s1", "u1", null))?.hibernatedAt).toBeNull();
  });

  it("markEnded records the reason once and is idempotent", async () => {
    await repo.create({ id: "s1", ...base });
    const ended = await repo.markEnded("s1", "u1", "killed-unreachable");
    expect(ended?.endReason).toBe("killed-unreachable");
    const again = await repo.markEnded("s1", "u1", "killed");
    expect(again?.endReason).toBe("killed-unreachable");
  });

  it("lists active sessions of a host for a user and prunes old ended rows", async () => {
    await repo.create({ id: "s1", ...base });
    await repo.create({ id: "s2", ...base, tmuxSessionName: "b", displayName: "B" });
    await repo.markEnded("s2", "u1", "disappeared");
    expect((await repo.listActiveByHostForUser(1, "u1")).map((r) => r.id)).toEqual(["s1"]);
    await repo.pruneEndedOlderThan("2999-01-01T00:00:00.000Z");
    expect((await repo.listByUser("u1", { includeEnded: true })).total).toBe(1);
  });

  it("lists the distinct owner and host pairs that have active sessions", async () => {
    await repo.create({ id: "s1", ...base });
    await repo.create({ id: "s2", ...base, tmuxSessionName: "b", displayName: "B" });
    await repo.create({ id: "s3", ...base, userId: "u2", hostId: 2 });
    await repo.create({ id: "s4", ...base, hostId: 2, tmuxSessionName: "gone", displayName: "G" });
    await repo.markEnded("s4", "u1", "killed");
    const pairs = (await repo.listActiveOwnerHosts()).map((p) => `${p.userId}:${p.id}`).sort();
    expect(pairs).toEqual(["u1:1", "u2:2"]);
  });

  it("imports legacy rows idempotently without duplicating an active name", async () => {
    const row = { id: "legacy-1", ...base, createdAt: "2026-01-01T00:00:00.000Z", hibernatedAt: null, endedAt: null, endReason: null };
    expect(await repo.importRow(row)).toBe("imported");
    expect(await repo.importRow(row)).toBe("skipped");
    expect(await repo.importRow({ ...row, id: "legacy-2" })).toBe("skipped");
    expect((await repo.listByUser("u1")).total).toBe(1);
  });
});
