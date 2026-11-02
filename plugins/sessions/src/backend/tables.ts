import { defineTable, integer, refHost, refUser, text, timestamp, varchar } from "@termix-ssh/plugin-sdk/db";

/**
 * One row per persistent tmux session. A session is "active" while endedAt is
 * null. Termix tables cannot carry a partial unique index, so the rule "one
 * active session per host and tmux name" is enforced in the lifecycle code.
 */
export const sessions = defineTable(
  "sessions",
  {
    id: varchar(36).primaryKey(),
    userId: refUser(),
    hostId: refHost(),
    displayName: varchar(128).notNull(),
    tmuxSessionName: varchar(64).notNull(),
    managementState: varchar(16).notNull().default("managed"),
    expiryMode: varchar(16).notNull().default("manual"),
    expirySeconds: integer(),
    remoteCreatedAt: varchar(40),
    createdAt: timestamp().notNull().defaultNow(),
    lastAttachedAt: varchar(40),
    lastDetachedAt: varchar(40),
    expiresAt: varchar(40),
    lastObservedAt: varchar(40),
    hibernatedAt: varchar(40),
    endedAt: varchar(40),
    endReason: varchar(64),
  },
  {
    indexes: [
      { name: "idx_p_sessions_sessions_user_ended", columns: ["userId", "endedAt"] },
      { name: "idx_p_sessions_sessions_host_ended", columns: ["hostId", "endedAt"] },
      { name: "idx_p_sessions_sessions_host_tmux", columns: ["hostId", "tmuxSessionName"] },
    ],
  },
);

export const tables = [sessions];
