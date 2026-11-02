import { and, desc, eq, isNull, lt } from "drizzle-orm";

/** The row shape of the plugin's sessions table. */
export interface SessionRecord {
  id: string;
  userId: string;
  hostId: number;
  displayName: string;
  tmuxSessionName: string;
  managementState: string;
  expiryMode: string;
  expirySeconds: number | null;
  remoteCreatedAt: string | null;
  createdAt: string;
  lastAttachedAt: string | null;
  lastDetachedAt: string | null;
  expiresAt: string | null;
  lastObservedAt: string | null;
  hibernatedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
}

export interface SessionCreateInput {
  id: string;
  userId: string;
  hostId: number;
  displayName: string;
  tmuxSessionName: string;
  managementState: "managed" | "discovered";
  expiryMode: "manual" | "idle";
  expirySeconds?: number | null;
  remoteCreatedAt?: string | null;
}

export type SessionPatch = Partial<
  Pick<
    SessionRecord,
    | "displayName"
    | "tmuxSessionName"
    | "expiryMode"
    | "expirySeconds"
    | "expiresAt"
    | "lastObservedAt"
    | "lastAttachedAt"
    | "lastDetachedAt"
    | "hibernatedAt"
  >
>;

type Db = any;
type Table = any;

/**
 * Owner-scoped persistence for facts about remote tmux sessions.
 *
 * Plugin tables cannot carry a partial unique index, so "one active session
 * per host and tmux name" is checked here before every insert and rename.
 * Every write is followed by persist(), as the plugin rules require.
 */
export class SessionRepository {
  constructor(
    private readonly db: Db,
    private readonly table: Table,
    private readonly persist: (options?: { lazy?: boolean }) => Promise<void>,
  ) {}

  async create(input: SessionCreateInput): Promise<SessionRecord> {
    if (await this.findActiveByHostAndTmux(input.hostId, input.tmuxSessionName))
      throw new Error("PERSISTENT_SESSION_CONFLICT");
    await this.db.insert(this.table).values(input);
    await this.persist();
    return (await this.byId(input.id))!;
  }

  async findByIdForUser(id: string, userId: string): Promise<SessionRecord | null> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveByHostAndTmux(hostId: number, tmuxSessionName: string): Promise<SessionRecord | null> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.hostId, hostId),
          eq(this.table.tmuxSessionName, tmuxSessionName),
          isNull(this.table.endedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async listByUser(
    userId: string,
    options: { includeEnded?: boolean; limit?: number; offset?: number } = {},
  ): Promise<{ data: SessionRecord[]; total: number }> {
    const where = options.includeEnded
      ? eq(this.table.userId, userId)
      : and(eq(this.table.userId, userId), isNull(this.table.endedAt));
    const data = await this.db
      .select()
      .from(this.table)
      .where(where)
      .orderBy(desc(this.table.createdAt), desc(this.table.id))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);
    const all = await this.db.select({ id: this.table.id }).from(this.table).where(where);
    return { data, total: all.length };
  }

  async listActiveByHostForUser(hostId: number, userId: string): Promise<SessionRecord[]> {
    return this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.hostId, hostId), eq(this.table.userId, userId), isNull(this.table.endedAt)));
  }

  async update(id: string, userId: string, patch: SessionPatch): Promise<SessionRecord | null> {
    const current = await this.findByIdForUser(id, userId);
    if (!current) return null;
    if (patch.tmuxSessionName && patch.tmuxSessionName !== current.tmuxSessionName) {
      const conflict = await this.findActiveByHostAndTmux(current.hostId, patch.tmuxSessionName);
      if (conflict && conflict.id !== id) throw new Error("PERSISTENT_SESSION_CONFLICT");
    }
    await this.db.update(this.table).set(patch).where(eq(this.table.id, id));
    await this.persist();
    return this.findByIdForUser(id, userId);
  }

  /** Telemetry, not lifecycle state: written lazily so it does not hit disk every minute. */
  async touchLastObserved(id: string, lastObservedAt: string): Promise<void> {
    await this.db.update(this.table).set({ lastObservedAt }).where(eq(this.table.id, id));
    await this.persist({ lazy: true });
  }

  /** Marks the freeze state of a session's remote pane processes. */
  async setHibernatedAt(id: string, userId: string, hibernatedAt: string | null): Promise<SessionRecord | null> {
    const current = await this.findByIdForUser(id, userId);
    if (!current) return null;
    if (current.hibernatedAt === hibernatedAt) return current;
    await this.db.update(this.table).set({ hibernatedAt }).where(eq(this.table.id, id));
    await this.persist();
    return this.findByIdForUser(id, userId);
  }

  async markEnded(
    id: string,
    userId: string,
    reason: "killed" | "expired" | "disappeared" | "killed-unreachable",
  ): Promise<SessionRecord | null> {
    const row = await this.findByIdForUser(id, userId);
    if (!row) return null;
    if (row.endedAt) return row;
    await this.db
      .update(this.table)
      .set({ endedAt: new Date().toISOString(), endReason: reason })
      .where(eq(this.table.id, id));
    await this.persist();
    return this.findByIdForUser(id, userId);
  }

  async pruneEndedOlderThan(cutoff: string): Promise<void> {
    const rows = await this.db.select({ id: this.table.id }).from(this.table).where(lt(this.table.endedAt, cutoff));
    for (const row of rows) await this.db.delete(this.table).where(eq(this.table.id, row.id));
    if (rows.length) await this.persist();
  }

  /** Every (owner, host) pair that still has an active session, for the background pass. */
  async listActiveOwnerHosts(): Promise<{ id: number; userId: string }[]> {
    const rows = await this.db
      .select({ userId: this.table.userId, hostId: this.table.hostId })
      .from(this.table)
      .where(isNull(this.table.endedAt));
    const seen = new Set<string>();
    const out: { id: number; userId: string }[] = [];
    for (const row of rows) {
      const key = `${row.userId}:${row.hostId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: row.hostId, userId: row.userId });
    }
    return out;
  }

  /**
   * Inserts a row exported from the pre-plugin Sessions feature. Re-running is
   * safe: a known id, or an active row that would take an active name, is skipped.
   */
  async importRow(
    row: SessionCreateInput & Partial<Pick<SessionRecord, "createdAt" | "hibernatedAt" | "endedAt" | "endReason" | "lastAttachedAt" | "lastDetachedAt" | "lastObservedAt">>,
  ): Promise<"imported" | "skipped"> {
    if (await this.byId(row.id)) return "skipped";
    if (!row.endedAt && (await this.findActiveByHostAndTmux(row.hostId, row.tmuxSessionName))) return "skipped";
    await this.db.insert(this.table).values(row);
    await this.persist();
    return "imported";
  }

  private async byId(id: string): Promise<SessionRecord | null> {
    const rows = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
