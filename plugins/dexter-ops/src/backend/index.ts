import type { Router } from "express";
import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";
import { createBotClient } from "./client.js";
import { registerRoutes } from "./routes.js";

export async function activate(ctx: PluginContext): Promise<void> {
  const bot = createBotClient({
    config: async () => ({
      botUrl: await ctx.settings.get("botUrl"),
      token: await ctx.settings.get("token"),
    }),
    fetch: (url, init) => ctx.fetch(url, init as never),
  });

  registerRoutes(ctx.http.router<Router>(), {
    bot: bot.request,
    audit: (entry) => ctx.audit.record(entry),
    guard: () => ctx.rbac.require("dexter-ops.manage") as never,
  });
}

export async function deactivate(): Promise<void> {
  // Everything registered through ctx is disposed by core.
}
