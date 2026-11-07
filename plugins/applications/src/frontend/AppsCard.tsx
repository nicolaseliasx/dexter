import { ExternalLink, LayoutGrid } from "lucide-react";
import {
  usePermission,
  useTranslation,
  type DashboardCardProps,
} from "@termix-ssh/plugin-sdk/frontend";
import { Button, EmptyState } from "@termix-ssh/plugin-sdk/ui";
import { useCards } from "./useCards.js";
import { Tile, hostOf } from "./Tile.js";

export function AppsCard({ shell }: DashboardCardProps) {
  const { t } = useTranslation();
  const canView = usePermission("view");
  const { cards } = useCards(canView);
  if (!canView) return null;
  return (
    <div className="flex h-full flex-col">
      <div
        className="grid flex-1 content-start gap-2 p-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {cards.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title={t("empty.title")}
            className="col-span-full"
          />
        ) : (
          cards.map((card) => (
            <a
              key={card.id}
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 border border-border bg-card p-2 transition-colors hover:border-accent-brand/50"
            >
              <Tile card={card} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {card.name}
                </span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {hostOf(card.url)}
                </span>
              </span>
              <ExternalLink
                aria-hidden
                className="size-3.5 text-muted-foreground transition-colors group-hover:text-accent-brand"
              />
            </a>
          ))
        )}
      </div>
      <div className="flex justify-end border-t border-border px-2.5 py-1.5">
        <Button
          variant="ghost"
          size="xs"
          className="gap-1.5 text-muted-foreground"
          onClick={() => shell.openSingletonTab("applications")}
        >
          <LayoutGrid className="size-3.5" />
          {t("toolbar.openCatalog")}
        </Button>
      </div>
    </div>
  );
}
