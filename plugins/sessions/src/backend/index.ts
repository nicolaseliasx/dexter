import type { Router } from "express";
import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";
import { SshSessionGateway, type RunAs } from "./gateway.js";
import { PersistentSessionLifecycleService } from "./lifecycle.js";
import { PersistentSessionReconciler } from "./reconciler.js";
import { SessionRepository } from "./repository.js";
import { registerRoutes } from "./routes.js";
import { sessions } from "./tables.js";

const PASS_MS = 60_000;

export async function activate(ctx: PluginContext): Promise<void> {
  const table = await ctx.db.define(sessions);
  const db = await ctx.db.client();
  const repository = new SessionRepository(db as never, table as never, (options) => ctx.db.persist(options));

  // Routes already run as the caller; the timer has no request and needs asUser.
  const runAs: RunAs = (userId, fn) => (ctx.currentActor() === userId ? fn() : ctx.asUser(userId, fn));
  const gateway = new SshSessionGateway(ctx.ssh, runAs);
  const resolveHost = (hostId: number, userId: string) =>
    runAs(userId, async () => {
      const host = await ctx.hosts.get(hostId);
      return host ? { id: host.id } : null;
    });

  const lifecycle = new PersistentSessionLifecycleService(repository, gateway, resolveHost);
  const log = (level: "info" | "warn") => (message: string, fields?: Record<string, unknown>) =>
    ctx.log[level](fields ? `${message} ${JSON.stringify(fields)}` : message);
  const reconciler = new PersistentSessionReconciler(
    repository,
    gateway,
    () => repository.listActiveOwnerHosts(),
    resolveHost,
    undefined,
    {
      log: { info: log("info"), warn: log("warn") },
      reachability: (host, timeoutMs) => runAs(host.actingUserId, () => ctx.ssh.probe(host.id, { timeoutMs })),
      hibernateIdleHours: async () => Number((await ctx.settings.get("hibernateIdleHours")) ?? 0),
    },
  );

  registerRoutes(ctx.http.router<Router>(), {
    lifecycle,
    repository,
    reconcile: async (userId) => {
      const mine = (await repository.listActiveOwnerHosts()).filter((pair) => pair.userId === userId);
      return { hosts: (await reconciler.reconcileHosts(mine)).results };
    },
    actor: () => ctx.currentActor(),
    guard: () => ctx.rbac.require("sessions.use") as never,
    canAccessHost: async (hostId) => !!(await ctx.hosts.get(hostId)),
  });

  // schedule.every stops on disable and never overlaps with itself.
  ctx.schedule.every(PASS_MS, () => void reconciler.runOnce(), { jitterMs: 5_000 });
}

export async function deactivate(): Promise<void> {
  // Everything registered through ctx is disposed by core.
}
