export interface SessionRow {
  id: string;
  hostId: number;
  displayName: string;
  tmuxSessionName: string;
  hibernatedAt: string | null;
  endedAt: string | null;
  endReason?: string | null;
  createdAt: string;
  lastObservedAt?: string | null;
}

export const SESSION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
