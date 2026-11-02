import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Columns2, Moon, Pencil, SquareTerminal, Trash2 } from "lucide-react";
import {
  useHostStatus,
  useHosts,
  usePluginApi,
  useShell,
  useTabs,
  useToast,
  useTranslation,
} from "@termix-ssh/plugin-sdk/frontend";
import {
  AddButton,
  Button,
  EmptyState,
  ListRow,
  PanelList,
  PanelShell,
  SelectField,
  TextField,
  useConfirm,
} from "@termix-ssh/plugin-sdk/ui";
import { planSplit } from "./split-plan.js";
import { SESSION_NAME_PATTERN, type SessionRow } from "./types.js";

const POLL_MS = 30_000;

function errorCode(error: unknown): string | undefined {
  const e = error as { response?: { data?: { error?: { code?: string } } } };
  return e?.response?.data?.error?.code;
}

function HostBadge({ hostId }: { hostId: number }) {
  const status = useHostStatus(hostId);
  if (!status || status.status === "unknown") return null;
  const online = status.status === "online" || status.status === "reachable";
  return <span className={online ? "text-accent-brand" : "text-muted-foreground"}>{status.status}</span>;
}

export function SessionsPanel() {
  const { t } = useTranslation();
  const api = usePluginApi();
  const tabs = useTabs();
  const shell = useShell();
  const toast = useToast();
  const confirm = useConfirm();
  const { hosts } = useHosts();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostId, setHostId] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const hostById = useMemo(() => new Map(hosts.map((h) => [Number(h.id), h])), [hosts]);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: SessionRow[] }>("/");
      setRows(res.data.data);
    } catch {
      toast.error(t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [api, toast, t]);

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

  useEffect(() => {
    if (!hostId && hosts.length) setHostId(String(hosts[0].id));
  }, [hosts, hostId]);

  // "Split" opens the tab first; once the shell reports it as the active tab
  // (openTab is fire and forget), the effect below places it in a pane.
  const pendingSplit = useRef<string | null>(null);
  const shellRef = useRef(shell);
  shellRef.current = shell;
  useEffect(() => {
    const wanted = pendingSplit.current;
    if (!wanted || !shell) return;
    const active = shell.tabs.list.find((tab) => tab.id === shell.tabs.activeId);
    if (!active || (active.data as { tmuxSession?: string } | undefined)?.tmuxSession !== wanted) return;
    pendingSplit.current = null;
    const action = planSplit(active.id, shell.split.summaries);
    // The shell resolves the tab id from its own state, which lags this render
    // by a tick: acting immediately finds no tab and silently does nothing.
    if (action) setTimeout(() => shellRef.current?.split.handleAction(action), 50);
  }, [shell, shell?.tabs.activeId, shell?.tabs.list, shell?.split.summaries]);

  const attach = (row: SessionRow, split: boolean) => {
    const host = hostById.get(row.hostId);
    if (!host) return;
    pendingSplit.current = split ? row.tmuxSessionName : null;
    // The official SSH Terminal runs `tmux attach` for data.tmuxSession.
    tabs.openTab(host, "terminal", { label: row.displayName, data: { tmuxSession: row.tmuxSessionName } });
  };

  const create = async () => {
    const tmux = name.trim();
    if (!SESSION_NAME_PATTERN.test(tmux)) return toast.error(t("errors.invalidName"));
    setCreating(true);
    try {
      const res = await api.post<{ data: SessionRow }>("/", {
        hostId: Number(hostId),
        displayName: tmux,
        tmuxSessionName: tmux,
      });
      setName("");
      await refresh();
      attach(res.data.data, false);
      toast.success(t("created"));
    } catch (error) {
      toast.error(errorCode(error) === "PERSISTENT_SESSION_CONFLICT" ? t("errors.conflict") : t("errors.create"));
    } finally {
      setCreating(false);
    }
  };

  const rename = async (row: SessionRow, value: string) => {
    const next = value.trim();
    setRenaming(null);
    if (!next || next === row.displayName) return;
    try {
      await api.patch(`/${row.id}`, { displayName: next, tmuxSessionName: next });
      await refresh();
    } catch (error) {
      toast.error(errorCode(error) === "PERSISTENT_SESSION_CONFLICT" ? t("errors.conflict") : t("errors.rename"));
    }
  };

  const terminate = async (row: SessionRow) => {
    const ok = await confirm({
      title: t("terminate.title", { name: row.displayName }),
      description: t("terminate.description"),
      confirmLabel: t("terminate.confirm"),
    });
    if (!ok) return;
    try {
      await api.delete(`/${row.id}`);
    } catch (error) {
      const code = errorCode(error);
      const force = await confirm({
        title: t("force.title"),
        description: t(code === "PERSISTENT_SESSION_MARKER_MISMATCH" ? "force.mismatch" : "force.unreachable"),
        confirmLabel: t("force.confirm"),
      });
      if (!force) return;
      try {
        await api.delete(`/${row.id}?force=true`);
      } catch {
        toast.error(t("errors.terminate"));
        return;
      }
    }
    await refresh();
  };

  return (
    <PanelShell icon={<SquareTerminal className="size-4" />} title={t("panel.title")}>
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <SelectField
          label={t("create.host")}
          value={hostId}
          onChange={setHostId}
          options={hosts.map((h) => ({ value: String(h.id), label: h.name }))}
        />
        <TextField label={t("create.name")} value={name} onChange={setName} placeholder="codex-termix" />
        <AddButton label={t("create.button")} disabled={creating || !hostId || !name.trim()} onClick={() => void create()} />
      </div>
      <PanelList empty={!loading && rows.length === 0 ? <EmptyState icon={SquareTerminal} title={t("empty")} /> : null}>
        {rows.map((row) => {
          const host = hostById.get(row.hostId);
          const edit = renaming?.id === row.id;
          return (
            <ListRow
              key={row.id}
              title={
                edit ? (
                  <TextField
                    label={t("rename.label")}
                    value={renaming!.value}
                    onChange={(value) => setRenaming({ id: row.id, value })}
                  />
                ) : (
                  row.displayName
                )
              }
              meta={
                <span className="flex items-center gap-2 text-xs">
                  {host?.name ?? `#${row.hostId}`}
                  <HostBadge hostId={row.hostId} />
                  {row.hibernatedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Moon className="size-3" />
                      {t("standby")}
                    </span>
                  )}
                </span>
              }
              actions={
                <span className="flex items-center gap-1">
                  {edit ? (
                    <>
                      <Button size="sm" onClick={() => void rename(row, renaming!.value)}>
                        {t("rename.save")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRenaming(null)}>
                        {t("rename.cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" disabled={!host} onClick={() => attach(row, false)}>
                        <SquareTerminal className="mr-1 size-4" />
                        {t("attach")}
                      </Button>
                      <Button size="sm" variant="outline" disabled={!host} title={t("splitHint")} onClick={() => attach(row, true)}>
                        <Columns2 className="mr-1 size-4" />
                        {t("split")}
                      </Button>
                      <Button size="icon" variant="ghost" title={t("rename.title")} onClick={() => setRenaming({ id: row.id, value: row.displayName })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title={t("terminate.title", { name: row.displayName })} onClick={() => void terminate(row)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </span>
              }
            />
          );
        })}
      </PanelList>
    </PanelShell>
  );
}
