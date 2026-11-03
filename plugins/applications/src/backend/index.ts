import type { Router } from "express";
import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";
import { CardRepository } from "../repository.js";
import { registerRoutes } from "../routes.js";
import { cards } from "./tables.js";
import { fetchInventory } from "../discovery.js";

export async function activate(ctx: PluginContext): Promise<void> {
  const table = await ctx.db.define(cards);
  const db = await ctx.db.client();
  const repository = new CardRepository(db, table, () => ctx.db.persist());
  registerRoutes(ctx.http.router<Router>(), {
    repository,
    view: ctx.rbac.require("applications.view") as never,
    manage: ctx.rbac.require("applications.manage") as never,
    isAdmin: () => ctx.rbac.has("admin.plugins.manage"),
    discover: async () => {
      const url = await ctx.settings.get<string>("collectorUrl");
      const token = await ctx.settings.get<string>("collectorToken");
      const ca = await ctx.settings.get<string>("collectorCa");
      const saved = await repository.list();
      return fetchInventory(
        ctx.fetch,
        { url, token, ca },
        saved.map((card) => card.url),
      );
    },
  });
}
