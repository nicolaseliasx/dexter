import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithApp } from "@termix-ssh/plugin-sdk/testing";
import * as plugin from "../../src/frontend/index.js";
import en from "../../locales/en.json";
import manifest from "../../manifest.json" with { type: "json" };

afterEach(cleanup);

const card = (over: Record<string, unknown> = {}) => ({
  id: "1",
  name: "Cinema",
  url: "https://cinema.example.com/",
  description: "Filmes",
  icon: "CI",
  color: "#abcdef",
  order: 0,
  ...over,
});

function api(
  cards = [card()],
  suggestions = {
    items: [{ name: "service", source: "systemd", url: null }],
    unavailable: [] as string[],
  },
) {
  return {
    get: vi.fn(async (path: string) => ({
      data: { data: path === "/suggestions" ? suggestions : cards },
    })),
    post: vi.fn(async () => ({ data: { data: card() } })),
    put: vi.fn(async () => ({ data: { data: card() } })),
    patch: vi.fn(),
    delete: vi.fn(async () => ({ data: {} })),
  };
}

const field = (label: string) => {
  let node: HTMLElement | null = screen.getByText(label, { selector: "label" });
  while (node && !node.querySelector("input")) node = node.parentElement;
  return node!.querySelector("input") as HTMLInputElement;
};

async function open(permissions: string[], stub = api()) {
  const app = await renderWithApp(plugin as never, {
    pluginId: manifest.id,
    manifest: manifest as never,
    locales: en,
    api: stub as never,
    permissions,
  });
  app.renderTab("applications");
  return { app, stub };
}

describe("applications tab", () => {
  it("joins the dashboard switcher like Homepage and stays out of the sidebar", async () => {
    const { app } = await open(["applications.view"]);
    expect(app.registered.tabs()).toContain("applications");
    expect(app.registered.slot("dashboard.secondaryView")).toContain(
      "applications",
    );
    expect(app.registered.railItems()).toEqual([]);
    expect(app.registered.panels()).toEqual([]);
  });

  it("shows cards as links with initials, host and a themed search box, and filters them", async () => {
    await open(["applications.view"]);
    const link = await screen.findByRole("link", { name: /cinema/i });
    expect(link.getAttribute("href")).toBe("https://cinema.example.com/");
    expect(screen.getByText("CI")).toBeTruthy();
    expect(screen.getByText("cinema.example.com")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/search applications/i), {
      target: { value: "nothing" },
    });
    expect(screen.queryByRole("link", { name: /cinema/i })).toBeNull();
    expect(screen.getByText(/no applications/i)).toBeTruthy();
  });

  it("hides every management control from readers", async () => {
    await open(["applications.view"]);
    await screen.findByRole("link", { name: /cinema/i });
    for (const name of [/add application/i, /edit cinema/i, /delete cinema/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("gives managers toolbar actions and creates an application from the in-place form", async () => {
    const { stub } = await open(
      ["applications.view", "applications.manage"],
      api([]),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /add application/i }),
    );
    fireEvent.change(field("Name"), { target: { value: "Blog" } });
    fireEvent.change(field("URL"), {
      target: { value: "https://blog.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(stub.post).toHaveBeenCalledWith(
        "/",
        expect.objectContaining({
          name: "Blog",
          url: "https://blog.example.com",
        }),
      ),
    );
  });

  it("keeps the form open and explains an invalid URL instead of saving", async () => {
    const { stub } = await open(
      ["applications.view", "applications.manage"],
      api([]),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /add application/i }),
    );
    fireEvent.change(field("Name"), { target: { value: "Blog" } });
    fireEvent.change(field("URL"), { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/valid http/i)).toBeTruthy();
    expect(stub.post).not.toHaveBeenCalled();
  });

  it("offers readers no scan", async () => {
    await open(["applications.view"]);
    await screen.findByRole("link", { name: /cinema/i });
    for (const name of [/scan for suggestions/i])
      expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("opens a discovered service in the form, prefilled, without saving", async () => {
    const { stub } = await open(
      ["applications.view", "applications.manage"],
      api([]),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /scan for suggestions/i }),
    );
    expect(await screen.findByText("systemd")).toBeTruthy();
    fireEvent.click(
      await screen.findByRole("button", { name: /review service/i }),
    );
    expect(field("Name").value).toBe("service");
    expect(field("URL").value).toBe("");
    expect(stub.post).not.toHaveBeenCalled();
  });

  it("asks before deleting", async () => {
    const { stub } = await open(["applications.view", "applications.manage"]);
    fireEvent.click(
      await screen.findByRole("button", { name: /delete cinema/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith("/1"));
  });
});

describe("applications load failure", () => {
  it("explains the failure and recovers on retry", async () => {
    const stub = api();
    const working = stub.get.getMockImplementation()!;
    stub.get.mockRejectedValue(new Error("down"));
    await open(["applications.view"], stub);
    const retry = await screen.findByRole("button", { name: /try again/i });
    stub.get.mockImplementation(working);
    fireEvent.click(retry);
    expect(await screen.findByRole("link", { name: /cinema/i })).toBeTruthy();
  });
});

describe("applications dashboard card", () => {
  const card = async (permissions: string[]) => {
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      locales: en,
      api: api() as never,
      permissions,
    });
    app.renderDashboardCard("apps");
    return app;
  };

  it("shows each application as a link and opens the catalog on request", async () => {
    const app = await card(["applications.view"]);
    const link = await screen.findByRole("link", { name: /cinema/i });
    expect(link.getAttribute("href")).toBe("https://cinema.example.com/");
    fireEvent.click(screen.getByRole("button", { name: /open catalog/i }));
    await waitFor(() =>
      expect(
        app.shellCalls.some(
          (call) =>
            call.method === "openSingletonTab" &&
            call.args[0] === "applications",
        ),
      ).toBe(true),
    );
  });

  it("shows nothing to people who cannot view applications", async () => {
    await card([]);
    expect(screen.queryByRole("link", { name: /cinema/i })).toBeNull();
  });
});

describe("applications dashboard view", () => {
  const view = async (
    permissions = ["applications.view", "applications.manage"],
  ) => {
    const onOpenSingletonTab = vi.fn();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      locales: en,
      api: api() as never,
      permissions,
    });
    app.renderSlot("dashboard.secondaryView", { onOpenSingletonTab });
    return { onOpenSingletonTab, writeText };
  };

  it("shows the catalog inside the dashboard, searchable", async () => {
    await view();
    expect(await screen.findByRole("link", { name: /cinema/i })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/search applications/i), {
      target: { value: "zzz" },
    });
    expect(screen.queryByRole("link", { name: /cinema/i })).toBeNull();
  });

  it("copies the /apps link and opens the full tab on request", async () => {
    const { onOpenSingletonTab, writeText } = await view();
    fireEvent.click(await screen.findByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/apps`);
    fireEvent.click(screen.getByRole("button", { name: /open full view/i }));
    expect(onOpenSingletonTab).toHaveBeenCalledWith("applications");
  });
});
