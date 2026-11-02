export interface BotStatus {
  api_version: number;
  compatible: boolean;
  bot_version: string;
  uptime_secs: number;
  watch_enabled: boolean;
  notifications_muted: boolean;
  muted_until: number | null;
  last_collect_at: number | null;
  hosts_total: number;
  hosts_down: number;
  active_alerts: number;
}
export interface BotHost {
  id: string;
  name: string;
  state: "up" | "down" | "unknown";
  checked_at: number | null;
}
export interface BotHostPolicy {
  id: string;
  name: string;
  read_roots: string[];
  log_roots: string[];
  services: string[];
  sudo_commands: string[];
}
export interface BotOp {
  id: string;
  name: string;
  host: string;
  description: string;
  destructive: boolean;
  enabled: boolean;
}
export interface BotAlert {
  id: number;
  key: string;
  active: boolean;
  severity: "warn" | "crit";
  text: string;
  since: number;
  acked: boolean;
}
export interface BotHistoryEntry {
  ts: number;
  host: string | null;
  action: string;
  detail: string;
  decision: string;
}
export interface Snapshot {
  status: BotStatus;
  hosts: BotHost[];
  policy: BotHostPolicy[];
  ops: BotOp[];
  alerts: BotAlert[];
  history: BotHistoryEntry[];
}

export function errorCode(error: unknown): string | undefined {
  const e = error as { response?: { data?: { error?: { code?: string } } } };
  return e?.response?.data?.error?.code;
}
