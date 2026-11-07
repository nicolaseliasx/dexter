import { useState } from "react";
import { Check, ExternalLink, LayoutGrid, Link } from "lucide-react";
import { Button, EmptyState, PanelShell } from "@termix-ssh/plugin-sdk/ui";
import {
  usePermission,
  usePluginApi,
  useTranslation,
  type TermixApp,
} from "@termix-ssh/plugin-sdk/frontend";
import type { CardInput } from "../catalog.js";
import type { Card } from "../repository.js";
import { CatalogView } from "./CatalogView.js";
import { AppsCard } from "./AppsCard.js";
import type { Suggestion } from "../discovery.js";
import { announceChange } from "./events.js";
import { useCards } from "./useCards.js";

function Catalog({ embedded = false }: { embedded?: boolean }) {
  const api = usePluginApi();
  const { t } = useTranslation();
  const canManage = usePermission("manage");
  const { cards, error, refresh } = useCards();
  const save = async (card: CardInput, id?: string) => {
    if (id) await api.put(`/${encodeURIComponent(id)}`, card);
    else await api.post("/", card);
    announceChange();
  };
  const remove = async (id: string) => {
    await api.delete(`/${encodeURIComponent(id)}`);
    announceChange();
  };
  const discover = async () =>
    (
      await api.get<{ data: { items: Suggestion[]; unavailable: string[] } }>(
        "/suggestions",
      )
    ).data.data;
  if (error)
    return (
      <PanelShell
        icon={<LayoutGrid className="size-4" />}
        title={t("panel.title")}
      >
        <div className="flex flex-col items-center gap-2 py-8">
          <EmptyState
            icon={LayoutGrid}
            title={t("errors.load")}
            className="py-0"
          />
          <Button variant="outline" size="sm" onClick={announceChange}>
            {t("errors.retry")}
          </Button>
        </div>
      </PanelShell>
    );
  return (
    <CatalogView
      cards={cards}
      canManage={canManage}
      embedded={embedded}
      refresh={refresh}
      save={save}
      remove={remove}
      discover={discover}
    />
  );
}

const ApplicationsTab = () => <Catalog />;

// The "Dashboard | Applications" switcher: the same view as the tab, inside the dashboard.
function DashboardAppsView(props: Record<string, unknown>) {
  const onOpenSingletonTab = props.onOpenSingletonTab as
    ((type: string) => void) | undefined;
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard
      .writeText(`${window.location.origin}/apps`)
      .catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const link =
    "flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("nav.applications")}
        </span>
        <div className="flex items-center gap-3">
          <button type="button" className={link} onClick={copyLink}>
            {copied ? (
              <>
                <Check size={10} className="text-accent-brand" />
                <span className="text-accent-brand">
                  {t("dashboard.linkCopied")}
                </span>
              </>
            ) : (
              <>
                <Link size={10} />
                {t("dashboard.copyLink")}
              </>
            )}
          </button>
          <button
            type="button"
            className={link}
            onClick={() => onOpenSingletonTab?.("applications")}
          >
            <ExternalLink size={10} />
            {t("dashboard.openFull")}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Catalog embedded />
      </div>
    </div>
  );
}

export function activate(app: TermixApp) {
  app.registerTab("applications", ApplicationsTab, {
    hostless: true,
    singleton: true,
    icon: LayoutGrid,
    titleKey: "tab.title",
  });
  app.registerSlotContribution("dashboard.secondaryView", {
    actionId: "applications",
    titleKey: "nav.applications",
    kind: "component",
    component: DashboardAppsView,
  });
  app.registerPaletteEntry({
    id: "applications.open",
    titleKey: "nav.applications",
    icon: LayoutGrid,
    keywords: ["applications", "apps", "links"],
    scope: "global",
    run: (shell) => shell.openSingletonTab("applications"),
  });
  app.registerDashboardCard({
    id: "apps",
    titleKey: "dashboard.apps",
    defaultHeight: 240,
    defaultPanel: "main",
    component: AppsCard,
  });
  // /apps behaves like clicking the entry: the normal shell loads and the tab opens.
  if (/^\/apps\/?$/.test(window.location.pathname))
    app.onDispose(
      app.tabs.onReady(() => app.tabs.openSingletonTab("applications")),
    );
}
