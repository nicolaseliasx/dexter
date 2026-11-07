import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm";

export interface SplitUrlLink {
  url: string;
  /** 0-based rows and columns; endCol is exclusive. */
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const URL_TAIL = /https?:\/\/[^\s"'<>`]+$/;
const TOKEN = /^[^\s"'<>`]+/;
const TRAILING_PUNCTUATION = /[)\].,;:!?]+$/;
const CLOSED_URL = /[)\].,;:!?]$/;
// Cells are padded with two or more spaces; single spaces stay inside a cell.
const CELL = /\S+(?: \S+)*/g;

/**
 * Finds a URL that a TUI table hard-wrapped onto the next row.
 *
 * Codex wraps long cell text itself, so xterm sees two unrelated rows instead
 * of one wrapped line and the web-links addon only matches the first half.
 * This is a heuristic: the URL must end its cell, another cell must follow on
 * the same row, and the next row must continue at the cell's start column.
 * Prose that merely ends in a URL is left alone. Columns assume single-width
 * characters.
 */
export function findSplitUrlLink(
  rows: readonly string[],
  rowIndex: number,
): SplitUrlLink | undefined {
  const row = rows[rowIndex];
  const next = rows[rowIndex + 1];
  if (!row || !next) return undefined;

  const cells = [...row.matchAll(CELL)];
  for (let i = 0; i < cells.length - 1; i++) {
    const cell = cells[i];
    const tail = URL_TAIL.exec(cell[0]);
    if (!tail || CLOSED_URL.test(tail[0])) continue;

    const cellStart = cell.index;
    if (cellStart > 0 && next[cellStart - 1]?.trim()) continue;
    const token = TOKEN.exec(next.slice(cellStart))?.[0];
    const continuation = token?.replace(TRAILING_PUNCTUATION, "");
    if (!continuation) continue;

    return {
      url: tail[0] + continuation,
      startRow: rowIndex,
      startCol: cellStart + tail.index,
      endRow: rowIndex + 1,
      endCol: cellStart + continuation.length,
    };
  }
  return undefined;
}

/**
 * Link provider for URLs split across table rows. Register it before the
 * web-links addon so it wins over the addon's partial match.
 */
export function createSplitUrlLinkProvider(
  terminal: Terminal,
  activate: (event: MouseEvent, url: string) => void,
): ILinkProvider {
  const readRows = (from: number): string[] => {
    const buffer = terminal.buffer.active;
    const rows: string[] = [];
    for (let i = from; i < from + 3; i++) {
      rows.push(buffer.getLine(i)?.translateToString(true) ?? "");
    }
    return rows;
  };

  return {
    provideLinks(y, callback) {
      // y is 1-based; a link can start on the row above or on this one.
      const links: ILink[] = [];
      for (const start of [y - 2, y - 1]) {
        if (start < 0) continue;
        const found = findSplitUrlLink(readRows(start), 0);
        if (!found) continue;
        links.push({
          text: found.url,
          range: {
            start: { x: found.startCol + 1, y: start + 1 },
            end: { x: found.endCol, y: start + 2 },
          },
          activate: (event) => activate(event, found.url),
        });
      }
      callback(links.length ? links : undefined);
    },
  };
}
