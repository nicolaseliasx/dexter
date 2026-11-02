import { useCallback, useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { usePluginApi, useToast, useTranslation } from "@termix-ssh/plugin-sdk/frontend";
import { Button, EmptyState, ListBadge, ListRow, PanelShell, Switch } from "@termix-ssh/plugin-sdk/ui";
import { errorCode, type BotOp, type Snapshot } from "./types.js";

const POLL_MS = 15_000;

function uptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-b border-border p-3">
      <h3 className="text-xs font-medium uppercase text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function DexterOpsPanel() {
  const { t } = useTranslation();
  const api = usePluginApi();
  const toast = useToast();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const get = async <T,>(path: string) => (await api.get<T>(path)).data;
      const status = await get<Snapshot["status"]>("/status");
      if (!status.compatible) {
        setSnap({ status, hosts: [], policy: [], ops: [], alerts: [], history: [] });
        setProblem(null);
        return;
      }
      const [hosts, policy, ops, alerts, history] = await Promise.all([
        get<{ hosts: Snapshot["hosts"] }>("/hosts"),
        get<{ hosts: Snapshot["policy"] }>("/policy"),
        get<{ ops: Snapshot["ops"] }>("/ops"),
        get<{ alerts: Snapshot["alerts"] }>("/alerts"),
        get<{ entries: Snapshot["history"] }>("/history"),
      ]);
      setSnap({ status, hosts: hosts.hosts, policy: policy.hosts, ops: ops.ops, alerts: alerts.alerts, history: history.entries });
      setProblem(null);
    } catch (error) {
      setProblem(errorCode(error) ?? "BOT_UNREACHABLE");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const run = async (action: () => Promise<unknown>, okKey: string) => {
    try {
      await action();
      toast.success(t(okKey));
    } catch (error) {
      toast.error(t(`errors.${errorCode(error) ?? "BOT_UNREACHABLE"}`, { defaultValue: t("errors.BOT_UNREACHABLE") }));
    }
    await refresh();
  };

  const toggle = (op: BotOp, enabled: boolean) =>
    run(() => api.put(`/ops/${op.id}`, { enabled }), enabled ? "toast.enabled" : "toast.disabled");
  const request = (op: BotOp) => {
    setAsking(null);
    return run(() => api.post(`/ops/${op.id}/request`), op.destructive ? "toast.awaiting" : "toast.started");
  };

  const title = t("panel.title");
  const shell = (children: React.ReactNode) => (
    <PanelShell icon={<Bot className="size-4" />} title={title}>
      {children}
    </PanelShell>
  );

  if (problem === "NOT_CONFIGURED" || problem === "INVALID_BOT_URL") {
    return shell(<EmptyState icon={Bot} title={t("setup.title")} hint={t("setup.hint")} />);
  }
  if (problem && !snap) {
    return shell(<EmptyState icon={Bot} title={t(`errors.${problem}`, { defaultValue: t("errors.BOT_UNREACHABLE") })} hint={t("setup.retry")} />);
  }
  if (!snap) return shell(<EmptyState icon={Bot} title={t("loading")} />);

  const { status } = snap;
  if (!status.compatible) {
    return shell(
      <Section title={t("status.title")}>
        <p className="text-sm">{t("status.incompatible", { version: status.bot_version ?? "?", api: status.api_version ?? "?" })}</p>
      </Section>,
    );
  }

  return shell(
    <>
      <Section title={t("status.title")}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ListBadge tone="brand">v{status.bot_version}</ListBadge>
          <span>{t("status.uptime", { value: uptime(status.uptime_secs) })}</span>
          <ListBadge tone={status.watch_enabled ? "success" : "muted"}>{t(status.watch_enabled ? "status.watchOn" : "status.watchOff")}</ListBadge>
          <ListBadge tone={status.hosts_down ? "destructive" : "success"}>{t("status.hosts", { down: status.hosts_down, total: status.hosts_total })}</ListBadge>
          <ListBadge tone={status.active_alerts ? "warning" : "muted"}>{t("status.alerts", { count: status.active_alerts })}</ListBadge>
        </div>
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex flex-col">
            <span className="text-sm">{t("mute.label")}</span>
            <span className="text-xs text-muted-foreground">{t("mute.description")}</span>
          </div>
          <Switch
            aria-label={t("mute.label")}
            checked={status.notifications_muted}
            onCheckedChange={(muted: boolean) =>
              void run(() => api.put("/notifications", { muted }), muted ? "toast.muted" : "toast.unmuted")
            }
          />
        </div>
      </Section>

      <Section title={t("ops.title")}>
        {snap.ops.length === 0 && <p className="text-sm text-muted-foreground">{t("ops.empty")}</p>}
        {snap.ops.map((op) => (
          <div key={op.id}>
            <ListRow
              title={op.name}
              badges={op.destructive ? <ListBadge tone="warning">{t("ops.destructive")}</ListBadge> : undefined}
              meta={`${op.host}${op.description ? ` · ${op.description}` : ""}`}
              dimmed={!op.enabled}
              trailing={
                <Switch
                  aria-label={op.name}
                  checked={op.enabled}
                  onCheckedChange={(checked: boolean) => void toggle(op, checked)}
                />
              }
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!op.enabled}
                  aria-label={t("ops.requestLabel", { name: op.name })}
                  onClick={() => (op.destructive ? setAsking(op.id) : void request(op))}
                >
                  {t("ops.request")}
                </Button>
              }
            />
            {asking === op.id && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs">
                <span>{t("ops.confirmPrompt")}</span>
                <Button size="sm" onClick={() => void request(op)}>
                  {t("ops.send")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </Button>
              </div>
            )}
          </div>
        ))}
      </Section>

      <Section title={t("alerts.title")}>
        {snap.alerts.filter((a) => a.active).length === 0 && <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>}
        {snap.alerts
          .filter((a) => a.active)
          .map((a) => (
            <ListRow
              key={a.id}
              title={a.text}
              badges={<ListBadge tone={a.severity === "crit" ? "destructive" : "warning"}>{t(`alerts.${a.severity}`)}</ListBadge>}
              meta={new Date(a.since * 1000).toLocaleString()}
              dimmed={a.acked}
              actions={
                a.acked ? (
                  <span className="text-xs text-muted-foreground">{t("alerts.acked")}</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void run(() => api.post(`/alerts/${a.id}/ack`), "toast.acked")}>
                    {t("alerts.ack")}
                  </Button>
                )
              }
            />
          ))}
      </Section>

      <Section title={t("hosts.title")}>
        {snap.hosts.map((h) => (
          <ListRow
            key={h.id}
            title={h.name}
            badges={<ListBadge tone={h.state === "up" ? "success" : h.state === "down" ? "destructive" : "muted"}>{t(`hosts.${h.state}`)}</ListBadge>}
          />
        ))}
      </Section>

      <Section title={t("policy.title")}>
        <p className="text-xs text-muted-foreground">{t("policy.hint")}</p>
        {snap.policy.map((p) => (
          <ListRow
            key={p.id}
            title={p.name}
            meta={t("policy.summary", {
              read: p.read_roots.join(", ") || "-",
              logs: p.log_roots.join(", ") || "-",
              services: p.services.join(", ") || "-",
              sudo: p.sudo_commands.join(", ") || "-",
            })}
          />
        ))}
      </Section>

      <Section title={t("history.title")}>
        {snap.history.length === 0 && <p className="text-sm text-muted-foreground">{t("history.empty")}</p>}
        {snap.history.slice(0, 20).map((e, i) => (
          <ListRow
            key={`${e.ts}-${i}`}
            title={`${e.action} · ${e.detail}`}
            meta={`${new Date(e.ts * 1000).toLocaleString()}${e.host ? ` · ${e.host}` : ""} · ${e.decision}`}
          />
        ))}
      </Section>
    </>,
  );
}
