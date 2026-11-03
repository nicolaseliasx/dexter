import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createMockCtx,
  createTestDb,
  type TestDb,
} from "@termix-ssh/plugin-sdk/testing";
import manifest from "../../manifest.json";
import { cards } from "../../src/backend/tables";
import { CardRepository } from "../../src/repository";

let db: TestDb;
let repository: CardRepository;
const card = {
  name: "App",
  url: "https://example.com/",
  description: "",
  icon: "A",
  color: "#abcdef",
  order: 2,
};
beforeEach(async () => {
  db = await createTestDb(process.cwd());
  const mock = createMockCtx({
    pluginId: manifest.id,
    manifest: manifest as never,
    capabilities: manifest.capabilities,
    db: db.database,
  });
  const table = await mock.ctx.db.define(cards);
  repository = new CardRepository(await mock.ctx.db.client(), table, () =>
    mock.ctx.db.persist(),
  );
});
afterEach(() => db?.close());
describe("shared catalog persistence", () => {
  it("creates, orders, updates and deletes cards durably", async () => {
    const first = await repository.create(card);
    const second = await repository.create({
      ...card,
      name: "First",
      order: 1,
    });
    expect((await repository.list()).map((row) => row.name)).toEqual([
      "First",
      "App",
    ]);
    expect(
      await repository.update(first.id, { ...card, name: "Changed" }),
    ).toMatchObject({ name: "Changed" });
    expect(await repository.remove(second.id)).toBe(true);
    expect(await repository.remove(second.id)).toBe(false);
    expect(await repository.update("missing", card)).toBeNull();
    expect(db.persisted).toBeGreaterThanOrEqual(4);
  });
});
