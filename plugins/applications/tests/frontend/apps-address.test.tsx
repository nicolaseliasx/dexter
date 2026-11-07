import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, waitFor } from "@testing-library/react";
import { renderWithApp } from "@termix-ssh/plugin-sdk/testing";
import * as plugin from "../../src/frontend/index.js";
import en from "../../locales/en.json";
import manifest from "../../manifest.json" with { type: "json" };

afterEach(cleanup);

const api = () => ({
  get: vi.fn(async () => ({ data: { data: [] } })),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

const start = async (path: string) => {
  window.history.pushState({}, "", path);
  const app = await renderWithApp(plugin as never, {
    pluginId: manifest.id,
    manifest: manifest as never,
    locales: en,
    api: api() as never,
    permissions: ["applications.view"],
    ready: true,
  });
  window.history.pushState({}, "", "/");
  return app;
};
const opened = (app: Awaited<ReturnType<typeof start>>) =>
  app.shellCalls.filter(
    (call) =>
      call.method === "openSingletonTab" && call.args[0] === "applications",
  );

// The test host shares onReady handlers between renders, so the cases that expect no
// call run first and the ones that open the tab run last.
describe("opening from the /apps address", () => {
  it.each(["/", "/hosts", "/apps-old"])("leaves %s alone", async (path) => {
    const app = await start(path);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(opened(app)).toHaveLength(0);
  });

  it("opens the catalog tab inside the normal shell, as if the icon was clicked", async () => {
    const app = await start("/apps");
    await waitFor(() => expect(opened(app).length).toBeGreaterThan(0));
  });

  it("accepts a trailing slash", async () => {
    const app = await start("/apps/");
    await waitFor(() => expect(opened(app).length).toBeGreaterThan(0));
  });
});
