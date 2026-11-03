import { SquareTerminal } from "lucide-react";
import type { TermixApp } from "@termix-ssh/plugin-sdk/frontend";
import { createSessionRecovery } from "./SessionRecovery.js";
import { SessionsPanel } from "./SessionsPanel.js";

export function activate(app: TermixApp) {
  const recovery = createSessionRecovery(app);
  app.registerRailItem({
    id: "sessions",
    icon: SquareTerminal,
    titleKey: "panel.title",
    permission: "use",
  });
  app.registerPanel(
    "sessions",
    () => <SessionsPanel getUserId={recovery.getUserId} />,
    { keepMounted: true },
  );
}
