import { Bot } from "lucide-react";
import type { TermixApp } from "@termix-ssh/plugin-sdk/frontend";
import { DexterOpsPanel } from "./DexterOpsPanel.js";

export function activate(app: TermixApp) {
  app.registerRailItem({
    id: "dexter-ops",
    icon: Bot,
    titleKey: "panel.title",
    permission: "manage",
  });
  app.registerPanel("dexter-ops", DexterOpsPanel, { keepMounted: true });
}
