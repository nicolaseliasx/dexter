import { useLayoutEffect } from "react";
import {
  useCurrentUser,
  useShell,
  useToast,
  type ShellController,
  type TermixApp,
} from "@termix-ssh/plugin-sdk/frontend";
import {
  announceSession,
  getSession,
  knownView,
  hasWindowCache,
  readCache,
  readCacheState,
  writeCache,
  SESSION_CHANGED,
  synchronizeSession,
  type RecoveryCache,
  type SavedLayout,
} from "./recovery.js";
import type { SessionRow } from "./types.js";

/** One coordinator per activation; no terminal output ever enters this store. */
export function createSessionRecovery(app: TermixApp) {
  let userId: string | null = null;
  let shell: ShellController | null = null;
  let restored = false;
  let disposed = false;
  let failed = false;
  let notify: ((message: string) => void) | undefined;
  let saving = false;
  let frame: number | null = null;
  const exemptions = new Map<string, () => void>();
  const release = () => {
    for (const off of exemptions.values()) off();
    exemptions.clear();
  };
  const warn = () => {
    if (!failed) notify?.(app.t("recovery.failed"));
    failed = true;
    release();
  };
  const save = () => {
    if (!restored || disposed || saving || !userId || !shell) return;
    const views = shell.tabs.list.filter(
      (tab) =>
        tab.type === "terminal" &&
        typeof tab.data?.sessionsSessionId === "string",
    );
    const layout = app.tabs.getLayout({
      tabIds: views.map((tab) => tab.id),
    }) as SavedLayout | null;
    if (!layout) return;
    const links: RecoveryCache["links"] = {};
    // Sanitize to metadata owned by Sessions, even if another plugin added payload fields.
    const tabs = layout.tabs
      .map((tab) => {
        const view = views.find(
          (view) => view.instanceId === tab.sourceInstanceId,
        );
        if (!view) return null;
        const sessionId = String(view.data!.sessionsSessionId);
        links[tab.slotId] = {
          sessionId,
          hostId: Number(view.host?.id),
          instanceId: view.instanceId,
        };
        return {
          ...tab,
          data: {
            sessionsSessionId: sessionId,
            tmuxSession: view.data!.tmuxSession,
          },
        };
      })
      .filter((tab): tab is NonNullable<typeof tab> => tab !== null);
    const value: RecoveryCache = {
      version: 1,
      layout: { ...layout, tabs },
      links,
      selectedHost: readCache(userId)?.selectedHost ?? "",
    };
    saving = true;
    const ok = writeCache(userId, value);
    saving = false;
    release();
    if (!ok) {
      warn();
      return;
    }
    failed = false;
    for (const view of views)
      exemptions.set(view.id, app.tabs.markRecoverable(view.id));
  };
  const scheduleSave = () => {
    release();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      save();
    });
  };
  const restore = async () => {
    const deadline = Date.now() + 10_000;
    while (
      (!userId || !shell?.hosts.loaded) &&
      !disposed &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (disposed) return;
    if (!userId || !shell?.hosts.loaded) {
      warn();
      return;
    }
    const ownWindow = hasWindowCache(userId);
    const cacheState = readCacheState(userId);
    if (cacheState.failed) {
      // Core records omit plugin payloads. Keep known managed views behind the
      // identity resolver even when their layout cannot be recovered.
      for (const view of shell.tabs.list) {
        const known = knownView(userId, view.instanceId);
        if (
          view.type === "terminal" &&
          known &&
          known.hostId === Number(view.host?.id)
        ) {
          app.tabs.updateTabData(view.id, {
            sessionsSessionId: known.sessionId,
          });
        }
      }
      warn();
      return;
    }
    const cached = cacheState.value;
    const selectedInstances = new Set(
      ownWindow
        ? Object.values(cached?.links ?? {}).map((link) => link.instanceId)
        : [],
    );
    const foreignViews = new Set<string>();
    for (const view of shell.tabs.list) {
      if (view.type !== "terminal") continue;
      const known = knownView(userId, view.instanceId);
      if (
        known &&
        known.hostId === Number(view.host?.id) &&
        !selectedInstances.has(view.instanceId)
      ) {
        foreignViews.add(view.id);
        app.tabs.closeTab(view.id, {
          connectionAlreadyConfirmed: true,
          preserveSavedRecord: true,
        });
      }
    }
    for (const split of shell.split?.summaries ?? []) {
      const ids = split.panes.flatMap((pane) =>
        pane.tabId ? [pane.tabId] : [],
      );
      if (ids.length && ids.every((id) => foreignViews.has(id)))
        app.tabs.closeTab(split.id, { preserveSavedRecord: true });
    }
    if (!cached) {
      restored = true;
      return;
    }
    const hosts = shell.hosts.list;
    const existingTabs: Record<string, string> = {};
    const removed = new Set<string>();
    const used = new Set<string>();
    const remove = (slot: string) => {
      removed.add(slot);
      const link = cached.links[slot];
      const old = shell!.tabs.list.find(
        (view) =>
          view.instanceId === link.instanceId &&
          Number(view.host?.id) === link.hostId,
      );
      if (old) app.tabs.closeTab(old.id, { connectionAlreadyConfirmed: true });
    };
    try {
      await Promise.all(
        cached.layout.tabs.map(async (tab) => {
          const link = cached.links[tab.slotId];
          const host = hosts.find((host) => Number(host.id) === link.hostId);
          if (!host) {
            remove(tab.slotId);
            return;
          }
          try {
            const response = await app.api.get<{ data: SessionRow }>(
              `/${encodeURIComponent(link.sessionId)}`,
              { timeout: 10_000 },
            );
            const row = response.data.data;
            if (
              row.id !== link.sessionId ||
              row.hostId !== link.hostId ||
              row.endedAt
            ) {
              remove(tab.slotId);
              return;
            }
            tab.label = row.displayName;
            tab.customLabel = row.displayName;
            tab.data = {
              sessionsSessionId: row.id,
              tmuxSession: row.tmuxSessionName,
            };
          } catch (error) {
            const status = (error as { response?: { status?: number } })
              .response?.status;
            if (status === 403 || status === 404) {
              remove(tab.slotId);
              return;
            }
            // Restore a retryable view; its terminal resolver refuses to attach until validation succeeds.
            tab.data = { sessionsSessionId: link.sessionId };
          }
          const candidates = ownWindow
            ? shell!.tabs.list.filter(
                (view) =>
                  !used.has(view.id) &&
                  Number(view.host?.id) === link.hostId &&
                  view.type !== "split-screen",
              )
            : [];
          const existing =
            candidates.find(
              (view) => link.instanceId && view.instanceId === link.instanceId,
            ) ??
            candidates.find(
              (view) => view.data?.sessionsSessionId === link.sessionId,
            );
          if (existing) {
            existingTabs[tab.slotId] = existing.id;
            used.add(existing.id);
          }
        }),
      );
      if (disposed) return;
      cached.layout.tabs = cached.layout.tabs.filter(
        (tab) => !removed.has(tab.slotId),
      );
      await app.tabs.applyLayout(cached.layout, {
        mode: "merge",
        existingTabs,
      });
      restored = true;
    } catch {
      warn();
    }
  };
  const generations = new Map<string, number>();
  const onChanged = (event: Event) => {
    if (!shell) return;
    const { row, alreadySynchronized } = (
      event as CustomEvent<{ row: SessionRow; alreadySynchronized: boolean }>
    ).detail;
    generations.set(row.id, (generations.get(row.id) ?? 0) + 1);
    if (!alreadySynchronized)
      synchronizeSession(row, shell.tabs.list, app.tabs);
    scheduleSave();
  };
  let refreshing = false;
  const refresh = async () => {
    if (
      refreshing ||
      !restored ||
      !shell ||
      disposed ||
      document.visibilityState === "hidden"
    )
      return;
    refreshing = true;
    const views = [
      ...new Map(
        shell.tabs.list
          .filter((tab) => typeof tab.data?.sessionsSessionId === "string")
          .map((tab) => [String(tab.data!.sessionsSessionId), tab]),
      ).values(),
    ];
    try {
      await Promise.all(
        views.map(async (tab) => {
          const id = String(tab.data!.sessionsSessionId);
          const generation = generations.get(id);
          try {
            const res = await app.api.get<{ data: SessionRow }>(
              `/${encodeURIComponent(id)}`,
              { timeout: 10_000 },
            );
            if (!disposed && shell && generations.get(id) === generation)
              synchronizeSession(res.data.data, shell.tabs.list, app.tabs);
          } catch {
            /* Unavailable is not ended. */
          }
        }),
      );
    } finally {
      refreshing = false;
    }
  };
  let restoration: Promise<void> | undefined;
  const ensureRestored = () => (restoration ??= restore());
  const offRestore = app.tabs.onBeforeReady(ensureRestored);
  const offChange = app.tabs.onChange(scheduleSave);
  const offReady = app.tabs.onReady(async () => {
    await ensureRestored();
    if (!disposed) scheduleSave();
  });
  window.addEventListener(SESSION_CHANGED, onChanged);
  window.addEventListener("pagehide", save);
  const onVisible = () => {
    if (document.visibilityState === "hidden") save();
    else void refresh();
  };
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(() => void refresh(), 30_000);
  app.registerAction(
    "sessions.resolveAttachment",
    (async (id: string, hostId: number) => {
      if (!shell?.hosts.list.some((host) => Number(host.id) === hostId))
        throw new Error("Host is unavailable");
      const row = await getSession(app.api, id, hostId);
      announceSession(row);
      return { name: row.tmuxSessionName, target: row.tmuxTarget };
    }) as never,
    { permission: "use" },
  );
  app.onDispose(() => {
    disposed = true;
    offRestore();
    offChange();
    offReady();
    release();
    clearInterval(timer);
    if (frame !== null) cancelAnimationFrame(frame);
    window.removeEventListener(SESSION_CHANGED, onChanged);
    window.removeEventListener("pagehide", save);
    document.removeEventListener("visibilitychange", onVisible);
  });
  function Controller() {
    const currentUser = useCurrentUser();
    const state = useShell();
    const toast = useToast();
    useLayoutEffect(() => {
      userId = currentUser?.userId ?? null;
      shell = state;
      notify = toast.warning;
    });
    return null;
  }
  app.registerAction("sessions.recovery", () => {}, { permission: "use" });
  app.registerSlotContribution("shell.overlay", {
    actionId: "sessions.recovery",
    titleKey: "panel.title",
    kind: "component",
    component: Controller,
  });
  return { getUserId: () => userId };
}
