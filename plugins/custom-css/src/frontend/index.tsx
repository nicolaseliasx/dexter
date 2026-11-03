import type { TermixApp } from "@termix-ssh/plugin-sdk/frontend";
import { CustomCss } from "./CustomCss.js";

export function activate(app: TermixApp) {
  app.registerSlotContribution("shell.overlay", {
    actionId: "custom-css.styles",
    titleKey: "plugin.name",
    kind: "component",
    component: CustomCss,
  });
}
