import { useMemo, useState } from "react";
import {
  ExternalLink,
  LayoutGrid,
  Pencil,
  RefreshCw,
  ScanSearch,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useToast,
  useTranslation,
  usePluginPanelView,
} from "@termix-ssh/plugin-sdk/frontend";
import {
  AddButton,
  Button,
  DataView,
  EmptyState,
  ListBadge,
  ListRow,
  ListRowAction,
  PANEL,
  PanelSearch,
  PanelShell,
  ViewToggle,
  cn,
  useConfirm,
  type DataColumn,
} from "@termix-ssh/plugin-sdk/ui";
import type { CardInput } from "../catalog.js";
import { ApplicationForm, emptyCard } from "./ApplicationForm.js";
import { Tile, hostOf } from "./Tile.js";
import type { Card } from "../repository.js";
import type { Suggestion } from "../discovery.js";

type Inventory = { items: Suggestion[]; unavailable: string[] };
type Props = {
  cards: Card[];
  canManage: boolean;
  save: (card: CardInput, id?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  embedded?: boolean;
  refresh?: () => Promise<void>;
  discover?: () => Promise<Inventory>;
  importHub?: () => Promise<void>;
};

function CardActions({
  card,
  canManage,
  onEdit,
  onDelete,
}: {
  card: Card;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  if (!canManage) return null;
  return (
    <span className="relative z-10 flex items-center gap-0.5">
      <ListRowAction
        label={t("card.edit", { name: card.name })}
        onClick={onEdit}
      >
        <Pencil className="size-3.5" />
      </ListRowAction>
      <ListRowAction
        label={t("card.delete", { name: card.name })}
        tone="destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </ListRowAction>
    </span>
  );
}

export function CatalogView({
  cards,
  canManage,
  save,
  remove,
  embedded,
  refresh,
  discover,
  importHub,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const layout = usePluginPanelView();
  const [query, setQuery] = useState("");
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [editing, setEditing] = useState<{
    id?: string;
    form: CardInput;
  } | null>(null);
  const [busy, setBusy] = useState<"scan" | "import" | "refresh" | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) =>
      `${card.name} ${card.description} ${card.url}`
        .toLowerCase()
        .includes(needle),
    );
  }, [cards, query]);

  const open = (form: CardInput, id?: string) => setEditing({ id, form });
  const run = async (
    kind: "scan" | "import" | "refresh",
    job: () => Promise<void>,
    failure: string,
  ) => {
    setBusy(kind);
    try {
      await job();
    } catch {
      toast.error(failure);
    } finally {
      setBusy(null);
    }
  };

  const askDelete = async (card: Card) => {
    const ok = await confirm({
      title: t("delete.title", { name: card.name }),
      description: t("delete.description"),
      confirmLabel: t("delete.confirm"),
    });
    if (ok) await remove(card.id).catch(() => toast.error(t("errors.delete")));
  };

  const renderCard = (card: Card) => (
    <div className="group relative flex h-full flex-col gap-3 border border-border bg-card p-3 transition-colors hover:border-accent-brand/50">
      <div className="flex items-start justify-between gap-2">
        <Tile card={card} />
        <span className="flex items-center gap-1 text-muted-foreground">
          <CardActions
            card={card}
            canManage={canManage}
            onEdit={() => open(card, card.id)}
            onDelete={() => void askDelete(card)}
          />
          <ExternalLink
            className="size-3.5 transition-colors group-hover:text-accent-brand"
            aria-hidden
          />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-semibold after:absolute after:inset-0"
        >
          {card.name}
        </a>
        {card.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {card.description}
          </p>
        )}
      </div>
      <div className="border-t border-border pt-2 font-mono text-[11px] text-muted-foreground">
        <span className="block truncate">{hostOf(card.url)}</span>
      </div>
    </div>
  );

  const columns: DataColumn<Card>[] = [
    {
      key: "name",
      header: t("list.name"),
      width: "minmax(0,1.2fr)",
      cell: (card) => (
        <span className="flex min-w-0 items-center gap-2">
          <Tile card={card} size="sm" />
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-medium"
          >
            {card.name}
          </a>
        </span>
      ),
    },
    {
      key: "url",
      header: t("list.address"),
      width: "minmax(0,1fr)",
      hideBelow: "md",
      cell: (card) => (
        <span className="truncate font-mono text-xs text-muted-foreground">
          {hostOf(card.url)}
        </span>
      ),
    },
    {
      key: "description",
      header: t("list.description"),
      width: "minmax(0,1.5fr)",
      hideBelow: "lg",
      cell: (card) => (
        <span className="truncate text-xs text-muted-foreground">
          {card.description}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            width: "72px",
            align: "end" as const,
            cell: (card: Card) => (
              <CardActions
                card={card}
                canManage
                onEdit={() => open(card, card.id)}
                onDelete={() => void askDelete(card)}
              />
            ),
          },
        ]
      : []),
  ];

  const iconButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false,
  ) => (
    <Button
      variant="outline"
      size="icon-sm"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  return (
    <>
      <PanelShell
        chrome={!embedded}
        icon={<LayoutGrid className="size-4" />}
        title={t("panel.title")}
        status={t("status.count", { count: cards.length })}
        scroll={false}
        actions={
          refresh && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              title={t("toolbar.refresh")}
              aria-label={t("toolbar.refresh")}
              disabled={busy === "refresh"}
              onClick={() => void run("refresh", refresh, t("errors.load"))}
            >
              <RefreshCw
                className={cn("size-3.5", busy === "refresh" && "animate-spin")}
              />
            </Button>
          )
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn("flex flex-wrap items-center", PANEL.gap, PANEL.body)}
          >
            <PanelSearch
              value={query}
              onChange={setQuery}
              placeholder={t("toolbar.search")}
              fill
            />
            <div className="ml-auto flex items-center gap-2">
              {canManage &&
                importHub &&
                iconButton(
                  t("toolbar.import"),
                  <Upload className="size-3.5" />,
                  () =>
                    void run(
                      "import",
                      async () => {
                        await importHub();
                        toast.success(t("imported"));
                      },
                      t("errors.import"),
                    ),
                  busy === "import",
                )}
              {canManage &&
                discover &&
                iconButton(
                  t("toolbar.scan"),
                  <ScanSearch
                    className={cn(
                      "size-3.5",
                      busy === "scan" && "animate-pulse",
                    )}
                  />,
                  () =>
                    void run(
                      "scan",
                      async () => setInventory(await discover()),
                      t("errors.scan"),
                    ),
                  busy === "scan",
                )}
              <ViewToggle
                view={layout.view}
                onView={layout.setView}
                columns={layout.columns}
                onColumns={layout.setColumns}
              />
              {canManage && (
                <AddButton
                  label={t("toolbar.add")}
                  onClick={() => open(emptyCard)}
                />
              )}
            </div>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto thin-scrollbar",
              PANEL.body,
            )}
          >
            {canManage && inventory && (
              <section className="mb-3 border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold">
                    {t("suggestions.title")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={t("suggestions.dismiss")}
                    aria-label={t("suggestions.dismiss")}
                    onClick={() => setInventory(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <p className="px-3 pt-2 text-[11px] text-muted-foreground">
                  {t("suggestions.notice")}
                </p>
                {inventory.unavailable.length > 0 && (
                  <p className="px-3 pt-1 text-[11px] text-destructive">
                    {t("suggestions.unavailable", {
                      sources: inventory.unavailable.join(", "),
                    })}
                  </p>
                )}
                {inventory.items.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    {t("suggestions.none")}
                  </p>
                ) : (
                  <div className="py-1">
                    {inventory.items.map((item, index) => (
                      <ListRow
                        key={`${item.source}-${item.name}-${index}`}
                        title={item.name}
                        badges={
                          <ListBadge tone="muted">{item.source}</ListBadge>
                        }
                        meta={item.url ?? undefined}
                        actions={
                          <ListRowAction
                            label={t("suggestions.review", { name: item.name })}
                            tone="brand"
                            onClick={() =>
                              open({
                                ...emptyCard,
                                name: item.name,
                                url: item.url ?? "",
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </ListRowAction>
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
            <DataView
              items={visible}
              view={layout.view}
              density={layout.density}
              getKey={(card) => card.id}
              renderCard={renderCard}
              columns={{}}
              size={layout.columns}
              minCardWidth={260}
              listColumns={columns}
              empty={
                <EmptyState
                  icon={LayoutGrid}
                  title={t("empty.title")}
                  hint={canManage ? t("empty.hint") : undefined}
                />
              }
            />
          </div>
        </div>
      </PanelShell>
      <ApplicationForm
        editing={editing}
        onClose={() => setEditing(null)}
        save={save}
      />
    </>
  );
}
