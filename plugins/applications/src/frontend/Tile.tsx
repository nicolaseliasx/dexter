import { cn } from "@termix-ssh/plugin-sdk/ui";
import type { Card } from "../repository.js";

const initials = (card: Pick<Card, "name" | "icon">) =>
  (card.icon || card.name.slice(0, 2)).toUpperCase();
export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function Tile({
  card,
  size = "md",
}: {
  card: Pick<Card, "name" | "icon" | "color">;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm font-mono font-bold",
        size === "md" ? "size-9 text-xs" : "size-6 text-[10px]",
      )}
      style={{
        color: card.color,
        background: `color-mix(in srgb, ${card.color} 16%, transparent)`,
      }}
    >
      {initials(card)}
    </span>
  );
}
