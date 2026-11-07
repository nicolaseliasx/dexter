import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithApp } from "@termix-ssh/plugin-sdk/testing";
import * as plugin from "../../src/frontend/index.js";
import en from "../../locales/en.json";
import manifest from "../../manifest.json" with { type: "json" };

const session = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  hostId: 1,
  displayName: "Work",
  tmuxSessionName: "work",
  hibernatedAt: null,
  endedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

function api(sessions = [session()]) {
  return {
    get: vi.fn(async () => ({
      data: {
        data: sessions,
        meta: { total: sessions.length, limit: 50, offset: 0 },
      },
    })),
    post: vi.fn(async () => ({
      data: {
        data: session({
          id: "new",
          displayName: "Fresh",
          tmuxSessionName: "fresh",
        }),
      },
    })),
    patch: vi.fn(async () => ({ data: { data: session() } })),
    put: vi.fn(),
    delete: vi.fn(async () => ({ data: { data: session({ endedAt: "x" }) } })),
  };
}

const hosts = [{ id: "1", name: "devhub", ip: "10.0.0.1", port: 22 }];

describe("sessions frontend", () => {
  it("registers a rail item gated on use and a panel", async () => {
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: api() as never,
    });
    expect(app.registered.railItems().map((r) => r.id)).toContain("sessions");
    expect(app.registered.panels()).toContain("sessions");
  });

  it("lists sessions and clicking a row opens the official terminal inside that tmux session", async () => {
    const stub = api();
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: stub as never,
    });
    app.renderPanel("sessions");
    fireEvent.click(await screen.findByText("Work"));
    await waitFor(() =>
      expect(app.shellCalls.some((c) => c.method === "openTab")).toBe(true),
    );
    const call = app.shellCalls.find((c) => c.method === "openTab")!;
    expect(call.args[1]).toBe("terminal");
    expect(call.args[2]).toMatchObject({ data: { tmuxSession: "work" } });
  });

  it("creates a session on the chosen host and opens it", async () => {
    const stub = api([]);
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: stub as never,
    });
    app.renderPanel("sessions");
    const name = await screen.findByPlaceholderText(/codex-termix/i);
    fireEvent.change(name, { target: { value: "fresh" } });
    fireEvent.click(screen.getByRole("button", { name: /create session/i }));
    await waitFor(() => expect(stub.post).toHaveBeenCalled());
    const body = (
      stub.post.mock.calls[0] as unknown as [string, Record<string, unknown>]
    )[1];
    expect(body).toMatchObject({
      hostId: 1,
      tmuxSessionName: "fresh",
      displayName: "fresh",
    });
    await waitFor(() =>
      expect(app.shellCalls.some((c) => c.method === "openTab")).toBe(true),
    );
  });

  it("keeps a menu button and the trash visible instead of revealing them on hover", async () => {
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: api() as never,
    });
    app.renderPanel("sessions");
    for (const name of [/more actions/i, /terminate work/i]) {
      const button = await screen.findByRole("button", { name });
      expect(button.closest(".hidden")).toBeNull();
    }
    expect(screen.queryByRole("button", { name: /rename/i })).toBeNull();
  });

  it("opens Rename and Open in split from the menu", async () => {
    const stub = api();
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: stub as never,
    });
    app.renderPanel("sessions");
    const open = async () => {
      const trigger = await screen.findByRole("button", {
        name: /more actions/i,
      });
      fireEvent.keyDown(trigger, { key: "Enter" });
    };
    await open();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Open in split" }),
    );
    await waitFor(() =>
      expect(app.shellCalls.some((c) => c.method === "openTab")).toBe(true),
    );
    await open();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    expect(await screen.findByDisplayValue("Work")).toBeTruthy();
  });

  it("asks to terminate inside the row and only then deletes", async () => {
    const stub = api();
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: stub as never,
    });
    app.renderPanel("sessions");
    fireEvent.click(
      await screen.findByRole("button", { name: /terminate work/i }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // Right under the card being ended, not inside its row or pinned elsewhere.
    const group = screen.getByRole("group", { name: /terminate work/i });
    expect(group.closest("[class*='group/row']")).toBeNull();
    expect(group.previousElementSibling?.className).toContain("group/row");
    expect(group.previousElementSibling?.textContent).toContain("Work");
    expect(stub.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Terminate" }));
    await waitFor(() => expect(stub.delete).toHaveBeenCalledWith("/s1"));
  });

  it("cancels the inline terminate question without deleting", async () => {
    const stub = api();
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: stub as never,
    });
    app.renderPanel("sessions");
    fireEvent.click(
      await screen.findByRole("button", { name: /terminate work/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Terminate" })).toBeNull();
    expect(stub.delete).not.toHaveBeenCalled();
  });

  it("words the name placeholder as an example", async () => {
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: api() as never,
    });
    app.renderPanel("sessions");
    expect(
      await screen.findByPlaceholderText(/^e\.g\. codex-termix$/i),
    ).toBeTruthy();
  });

  it("opens the Sessions panel when the shell is ready", async () => {
    const app = await renderWithApp(plugin as never, {
      pluginId: manifest.id,
      manifest: manifest as never,
      hosts,
      locales: en,
      api: api() as never,
      ready: true,
    });
    expect(app.shellCalls).toContainEqual({
      method: "openRailView",
      args: ["sessions"],
    });
  });
});
