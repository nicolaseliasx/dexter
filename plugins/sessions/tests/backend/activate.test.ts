import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createMockCtx, createTestDb, type TestDb } from "@termix-ssh/plugin-sdk/testing";
import manifest from "../../manifest.json" with { type: "json" };
import { activate } from "../../src/backend/index.js";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let testDb: TestDb | undefined;
afterEach(() => testDb?.close());

describe("activate", () => {
  it("mounts the routes behind the use permission and schedules the background pass", async () => {
    testDb = await createTestDb(pluginDir);
    let router: express.Router | null = null;
    const mock = createMockCtx({
      pluginId: manifest.id,
      manifest: manifest as never,
      capabilities: manifest.capabilities,
      db: testDb.database,
      router: () => (router = express.Router()),
      permissions: ["sessions.use"],
    });
    await activate(mock.ctx);
    expect(router).not.toBeNull();
    expect((router as unknown as { stack: unknown[] }).stack.length).toBeGreaterThanOrEqual(8);
    expect(mock.checked).toEqual(expect.arrayContaining(["db:own"]));
  });
});
