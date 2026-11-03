import type {
  PluginApiClient,
  ShellLayout,
  ShellTabState,
  TabsApi,
} from "@termix-ssh/plugin-sdk/frontend";
import type { SessionRow } from "./types.js";

export interface SavedTab {
  slotId: string;
  sourceInstanceId?: string;
  type: string;
  label: string;
  customLabel?: string;
  hostSyncId?: string | null;
  data?: Record<string, unknown>;
}
export interface SavedLayout extends ShellLayout {
  tabs: SavedTab[];
}
export interface RecoveryCache {
  version: 1;
  layout: SavedLayout;
  links: Record<
    string,
    { sessionId: string; hostId: number; instanceId?: string }
  >;
  selectedHost: string;
}
const key = (user: string) =>
  `sessions:recovery:v1:${encodeURIComponent(user)}`;

function parse(value: string | null): RecoveryCache | null {
  if (!value || value.length > 2_000_000) return null;
  try {
    const data = JSON.parse(value) as RecoveryCache;
    if (
      data.version !== 1 ||
      data.layout?.version !== 2 ||
      !Array.isArray(data.layout.tabs) ||
      data.layout.tabs.length > 200 ||
      !data.links ||
      typeof data.links !== "object" ||
      typeof data.selectedHost !== "string"
    )
      return null;
    for (const tab of data.layout.tabs) {
      const link = data.links[tab.slotId];
      if (
        tab.type !== "terminal" ||
        typeof tab.slotId !== "string" ||
        !link ||
        typeof link.sessionId !== "string" ||
        !Number.isSafeInteger(link.hostId)
      )
        return null;
    }
    return data;
  } catch {
    return null;
  }
}
export function readCacheState(user: string): {
  value: RecoveryCache | null;
  failed: boolean;
} {
  try {
    const own = sessionStorage.getItem(key(user));
    const raw = own !== null ? own : localStorage.getItem(key(user));
    const value = parse(raw);
    return { value, failed: raw !== null && value === null };
  } catch {
    return { value: null, failed: true };
  }
}
export function readCache(user: string): RecoveryCache | null {
  return readCacheState(user).value;
}
export function hasWindowCache(user: string): boolean {
  try {
    return sessionStorage.getItem(key(user)) !== null;
  } catch {
    return false;
  }
}
export function writeCache(user: string, data: RecoveryCache): boolean {
  try {
    const value = JSON.stringify(data);
    if (value.length > 2_000_000 || data.layout.tabs.length > 200) return false;
    sessionStorage.setItem(key(user), value);
    localStorage.setItem(key(user), value);
    // Independent per-instance keys cannot overwrite another window's identity index.
    for (const link of Object.values(data.links)) {
      if (link.instanceId)
        localStorage.setItem(
          `${key(user)}:known:${encodeURIComponent(link.instanceId)}`,
          JSON.stringify({ sessionId: link.sessionId, hostId: link.hostId }),
        );
    }
    return true;
  } catch {
    return false;
  }
}
export function knownView(
  user: string,
  instanceId: string,
): { sessionId: string; hostId: number } | null {
  try {
    const raw = localStorage.getItem(
      `${key(user)}:known:${encodeURIComponent(instanceId)}`,
    );
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value.sessionId === "string" &&
      Number.isSafeInteger(value.hostId)
      ? value
      : null;
  } catch {
    return null;
  }
}

export async function getSession(
  api: PluginApiClient,
  id: string,
  hostId: number,
): Promise<SessionRow & { tmuxTarget: string }> {
  const result = await api.get<{ data: SessionRow & { tmuxTarget: string } }>(
    `/${encodeURIComponent(id)}/attachment`,
    { timeout: 10_000 },
  );
  const row = result.data.data;
  if (row.id !== id || row.hostId !== hostId || row.endedAt)
    throw new Error("Session is no longer available");
  return row;
}
export function synchronizeSession(
  row: SessionRow,
  views: ShellTabState[],
  tabs: Pick<TabsApi, "renameTab" | "updateTabData" | "closeTab">,
) {
  for (const view of views) {
    if (view.type && view.type !== "terminal") continue;
    if (
      Number(view.host?.id) !== row.hostId ||
      view.data?.sessionsSessionId !== row.id
    )
      continue;
    if (row.endedAt)
      tabs.closeTab(view.id, { connectionAlreadyConfirmed: true });
    else {
      if (view.label !== row.displayName)
        tabs.renameTab(view.id, row.displayName);
      if (view.data?.tmuxSession !== row.tmuxSessionName) {
        tabs.updateTabData(view.id, {
          ...view.data,
          sessionsSessionId: row.id,
          tmuxSession: row.tmuxSessionName,
        });
      }
    }
  }
}

export const SESSION_CHANGED = "sessions:changed";
export function announceSession(row: SessionRow, alreadySynchronized = false) {
  window.dispatchEvent(
    new CustomEvent(SESSION_CHANGED, { detail: { row, alreadySynchronized } }),
  );
}
