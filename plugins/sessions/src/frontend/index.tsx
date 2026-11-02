import { SquareTerminal } from "lucide-react";
import type { TermixApp } from "@termix-ssh/plugin-sdk/frontend";
import { SessionsPanel } from "./SessionsPanel.js";

export function activate(app: TermixApp) {
  app.registerRailItem({
    id: "sessions",
    icon: SquareTerminal,
    titleKey: "panel.title",
    permission: "use",
  });
  app.registerPanel("sessions", SessionsPanel, { keepMounted: true });
}
