export interface SplitSummaryLike {
  id: string;
  full: boolean;
  panes: Array<{ id: string; tabId: string | null }>;
}

export type SplitAction =
  | { kind: "addToPane"; tabId: string; splitTabId: string; paneId: string }
  | { kind: "addPane"; tabId: string; splitTabId: string; edge: "right" }
  | { kind: "split"; tabId: string; edge: "right" };

/**
 * What the shell should do with a tab that was just opened for "Split":
 * fill an empty pane, grow a split that has room, or start a new split.
 * Returns null when the tab already sits in a split pane.
 */
export function planSplit(tabId: string, summaries: SplitSummaryLike[]): SplitAction | null {
  if (summaries.some((s) => s.panes.some((p) => p.tabId === tabId))) return null;
  for (const split of summaries) {
    const empty = split.panes.find((p) => p.tabId === null);
    if (empty) return { kind: "addToPane", tabId, splitTabId: split.id, paneId: empty.id };
  }
  const roomy = summaries.find((s) => !s.full);
  if (roomy) return { kind: "addPane", tabId, splitTabId: roomy.id, edge: "right" };
  return { kind: "split", tabId, edge: "right" };
}
