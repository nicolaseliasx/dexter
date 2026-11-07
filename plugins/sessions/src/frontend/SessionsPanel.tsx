import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Columns2,
  MoreHorizontal,
  Moon,
  Pencil,
  SquareTerminal,
  Trash2,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ListRow,
  PanelList,
  PanelShell,
  SelectField,
  TextField,
} from "@termix-ssh/plugin-sdk/ui";
import {
  announceSession,
  readCache,
  synchronizeSession,
  writeCache,
  SESSION_CHANGED,
} from "./recovery.js";
import { hostStatusView } from "./host-status.js";
import { planSplit } from "./split-plan.js";
import { SESSION_NAME_PATTERN, type SessionRow } from "./types.js";

const POLL_MS = 30_000;

function errorCode(error: unknown): string | undefined {
  const e = error as { response?: { data?: { error?: { code?: string } } } };
  return e?.response?.data?.error?.code;
}

function HostBadge({ hostId }: { hostId: number }) {
  const status = useHostStatus(hostId);
  const view = status ? hostStatusView(status.status) : null;
  if (!view) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${view.className}`}>
      <span className={`size-1.5 rounded-full ${view.dotClassName}`} />
      {view.label}
    </span>
  );
}

/** The question a row asks before it ends a session. */
type Pending = { id: string; step: "terminate" | "unreachable" | "mismatch" };

export function SessionsPanel({
  getUserId,
}: { getUserId?: () => string | null } = {}) {
  const { t } = useTranslation();
  const api = usePluginApi();
  const tabs = useTabs();
  const userId = getUserId?.();
  const shell = useShell();
  const toast = useToast();
  const { hosts } = useHosts();
  const refreshGeneration = useRef(0);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostId, setHostId] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [renaming, setRenaming] = useState<{
    id: string;
    value: string;
  } | null>(null);

  const hostById = useMemo(
    () => new Map(hosts.map((h) => [Number(h.id), h])),
    [hosts],
  );

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    try {
      const res = await api.get<{ data: SessionRow[] }>("/");
      if (generation === refreshGeneration.current) setRows(res.data.data);
    } catch {
      toast.error(t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [api, toast, t]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () =>
      document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!hostId && hosts.length) {
      const selected = userId ? readCache(userId)?.selectedHost : undefined;
      setHostId(
        hosts.some((host) => String(host.id) === selected)
          ? selected!
          : String(hosts[0].id),
      );
    }
  }, [hosts, hostId, userId]);

  useEffect(() => {
    const changed = () => void refresh();
    window.addEventListener(SESSION_CHANGED, changed);
    return () => window.removeEventListener(SESSION_CHANGED, changed);
  }, [refresh]);

  // "Split" opens the tab first; once the shell reports it as the active tab
  // (openTab is fire and forget), the effect below places it in a pane.
  const pendingSplit = useRef<string | null>(null);
  const shellRef = useRef(shell);
  shellRef.current = shell;
  useEffect(() => {
    const wanted = pendingSplit.current;
    if (!wanted || !shell) return;
    const active = shell.tabs.list.find(
      (tab) => tab.id === shell.tabs.activeId,
    );
    if (
      !active ||
      (active.data as { tmuxSession?: string } | undefined)?.tmuxSession !==
        wanted
    )
      return;
    pendingSplit.current = null;
    const action = planSplit(active.id, shell.split.summaries);
    // The shell resolves the tab id from its own state, which lags this render
    // by a tick: acting immediately finds no tab and silently does nothing.
    if (action)
      setTimeout(() => shellRef.current?.split.handleAction(action), 50);
  }, [shell, shell?.tabs.activeId, shell?.tabs.list, shell?.split.summaries]);

  const attach = (row: SessionRow, split: boolean) => {
    const host = hostById.get(row.hostId);
    if (!host) return;
    pendingSplit.current = split ? row.tmuxSessionName : null;
    // The official SSH Terminal runs `tmux attach` for data.tmuxSession.
    tabs.openTab(host, "terminal", {
      label: row.displayName,
      data: { sessionsSessionId: row.id, tmuxSession: row.tmuxSessionName },
    });
  };

  const create = async () => {
    const tmux = name.trim();
    if (!SESSION_NAME_PATTERN.test(tmux))
      return toast.error(t("errors.invalidName"));
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
      toast.error(
        errorCode(error) === "PERSISTENT_SESSION_CONFLICT"
          ? t("errors.conflict")
          : t("errors.create"),
      );
    } finally {
      setCreating(false);
    }
  };

  const rename = async (row: SessionRow, value: string) => {
    const next = value.trim();
    setRenaming(null);
    if (!next || next === row.displayName) return;
    try {
      const res = await api.patch<{ data: SessionRow }>(`/${row.id}`, {
        displayName: next,
        tmuxSessionName: next,
      });
      refreshGeneration.current++;
      setRows((current) =>
        current.map((row) =>
          row.id === res.data.data.id ? res.data.data : row,
        ),
      );
      synchronizeSession(res.data.data, shell?.tabs.list ?? [], tabs);
      announceSession(res.data.data, true);
      await refresh();
    } catch (error) {
      toast.error(
        errorCode(error) === "PERSISTENT_SESSION_CONFLICT"
          ? t("errors.conflict")
          : t("errors.rename"),
      );
    }
  };

  const terminate = async (row: SessionRow, force = false) => {
    setPending(null);
    let ended: SessionRow;
    try {
      const res = await api.delete<{ data: SessionRow }>(
        force ? `/${row.id}?force=true` : `/${row.id}`,
      );
      ended = res.data.data;
    } catch (error) {
      if (force) return toast.error(t("errors.terminate"));
      setPending({
        id: row.id,
        step:
          errorCode(error) === "PERSISTENT_SESSION_MARKER_MISMATCH"
            ? "mismatch"
            : "unreachable",
      });
      return;
    }
    refreshGeneration.current++;
    setRows((current) => current.filter((row) => row.id !== ended.id));
    synchronizeSession(ended, shell?.tabs.list ?? [], tabs);
    announceSession(ended, true);
    await refresh();
  };

  return (
    <PanelShell
      icon={<SquareTerminal className="size-4" />}
      title={t("panel.title")}
    >
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <SelectField
          label={t("create.host")}
          value={hostId}
          onChange={(value) => {
            setHostId(value);
            if (userId) {
              const cached = readCache(userId);
              if (cached)
                writeCache(userId, { ...cached, selectedHost: value });
            }
          }}
          options={hosts.map((h) => ({ value: String(h.id), label: h.name }))}
        />
        <TextField
          label={t("create.name")}
          value={name}
          onChange={setName}
          placeholder={t("create.placeholder")}
        />
        <AddButton
          label={t("create.button")}
          disabled={creating || !hostId || !name.trim()}
          onClick={() => void create()}
        />
      </div>
      <PanelList
        empty={
          !loading && rows.length === 0 ? (
            <EmptyState icon={SquareTerminal} title={t("empty")} />
          ) : null
        }
      >
        {rows.map((row) => {
          const host = hostById.get(row.hostId);
          const edit = renaming?.id === row.id;
          return (
            <Fragment key={row.id}>
              <ListRow
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
                onClick={edit || !host ? undefined : () => attach(row, false)}
                trailing={
                  <span
                    className="flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {edit ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => void rename(row, renaming!.value)}
                        >
                          {t("rename.save")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRenaming(null)}
                        >
                          {t("rename.cancel")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              title={t("menu.more")}
                              aria-label={t("menu.more")}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={!host}
                              title={t("splitHint")}
                              onSelect={() => attach(row, true)}
                            >
                              <Columns2 className="size-4" />
                              {t("menu.split")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                setRenaming({
                                  id: row.id,
                                  value: row.displayName,
                                })
                              }
                            >
                              <Pencil className="size-4" />
                              {t("menu.rename")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("terminate.title", {
                            name: row.displayName,
                          })}
                          aria-label={t("terminate.title", {
                            name: row.displayName,
                          })}
                          onClick={() =>
                            setPending({ id: row.id, step: "terminate" })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </span>
                }
              />
              {pending?.id === row.id && (
                <div
                  role="group"
                  aria-label={t("terminate.title", { name: row.displayName })}
                  className="flex flex-col gap-2 border-b border-l-2 border-b-border/40 border-l-destructive bg-destructive/5 p-3 text-sm"
                >
                  <p className="font-medium">
                    {pending.step === "terminate"
                      ? t("terminate.title", { name: row.displayName })
                      : t("force.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pending.step === "terminate"
                      ? t("terminate.description")
                      : t(`force.${pending.step}`)}
                  </p>
                  <span className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setPending(null)}>
                      {t("terminate.cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        void terminate(row, pending.step !== "terminate")
                      }
                    >
                      {pending.step === "terminate"
                        ? t("terminate.confirm")
                        : t("force.confirm")}
                    </Button>
                  </span>
                </div>
              )}
            </Fragment>
          );
        })}
      </PanelList>
    </PanelShell>
  );
}
