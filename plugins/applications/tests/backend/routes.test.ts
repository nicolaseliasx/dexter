import { describe, expect, it, vi } from "vitest";
import { registerRoutes } from "../../src/routes";

describe("catalog routes", () => {
  it("does not ship the old hub import", () => {
    const routes: Record<string, Function[]> = {};
    const router = Object.fromEntries(
      ["get", "post", "put", "delete"].map((method) => [
        method,
        (path: string, ...handlers: Function[]) => {
          routes[`${method} ${path}`] = handlers;
        },
      ]),
    );
    registerRoutes(router as never, {
      repository: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
      view: (() => {}) as never,
      manage: (() => {}) as never,
      isAdmin: async () => true,
    });
    expect(routes["post /import-app-hub"]).toBeUndefined();
  });
  it("returns discovery only to administrators", async () => {
    const routes: Record<string, Function[]> = {};
    const router = Object.fromEntries(
      ["get", "post", "put", "delete"].map((method) => [
        method,
        (path: string, ...handlers: Function[]) => {
          routes[`${method} ${path}`] = handlers;
        },
      ]),
    );
    const repository = {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    const discover = vi.fn().mockResolvedValue({ items: [], unavailable: [] });
    registerRoutes(router as never, {
      repository,
      view: (() => {}) as never,
      manage: (() => {}) as never,
      isAdmin: async () => false,
      discover,
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    await routes["get /suggestions"][1]({}, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(discover).not.toHaveBeenCalled();
  });
  it("rejects invalid input without writing and allows administrators to create cards", async () => {
    const routes: Record<string, Function[]> = {};
    const router = Object.fromEntries(
      ["get", "post", "put", "delete"].map((method) => [
        method,
        (path: string, ...handlers: Function[]) => {
          routes[`${method} ${path}`] = handlers;
        },
      ]),
    );
    const repository = {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "1" }),
      update: vi.fn(),
      remove: vi.fn(),
    };
    registerRoutes(router as never, {
      repository,
      view: (() => {}) as never,
      manage: (() => {}) as never,
      isAdmin: async () => true,
    });
    const handler = routes["post /"][1];
    const response = () => {
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      return res;
    };
    const bad = response();
    await handler({ body: { name: "App", url: "javascript:alert(1)" } }, bad);
    expect(bad.status).toHaveBeenCalledWith(400);
    expect(repository.create).not.toHaveBeenCalled();
    const good = response();
    await handler({ body: { name: "App", url: "https://example.com" } }, good);
    expect(good.status).toHaveBeenCalledWith(201);
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("refuses writes without administrator authority", async () => {
    const routes: Record<string, Function[]> = {};
    const router = Object.fromEntries(
      ["get", "post", "put", "delete"].map((method) => [
        method,
        (path: string, ...handlers: Function[]) => {
          routes[`${method} ${path}`] = handlers;
        },
      ]),
    );
    const repository = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    registerRoutes(router as never, {
      repository,
      view: (() => {}) as never,
      manage: (() => {}) as never,
      isAdmin: async () => false,
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    await routes["post /"][1](
      { body: { name: "App", url: "https://example.com" } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
