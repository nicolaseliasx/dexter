import { useCallback, useEffect, useState } from "react";
import { usePluginApi } from "@termix-ssh/plugin-sdk/frontend";
import type { Card } from "../repository.js";
import { CATALOG_CHANGED } from "./events.js";

/** The catalog, kept fresh whenever any view of the plugin changes it. */
export function useCards(enabled = true) {
  const api = usePluginApi();
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    const result = await api.get<{ data: Card[] }>("/");
    setCards(result.data.data);
    setError(false);
  }, [api]);
  useEffect(() => {
    if (!enabled) return;
    const load = () => void refresh().catch(() => setError(true));
    load();
    window.addEventListener(CATALOG_CHANGED, load);
    return () => window.removeEventListener(CATALOG_CHANGED, load);
  }, [enabled, refresh]);
  return { cards, error, refresh };
}
