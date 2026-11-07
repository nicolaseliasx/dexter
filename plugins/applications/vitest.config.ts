import path from "node:path";
import { fileURLToPath } from "node:url";
import { pluginVitestConfig } from "@termix-ssh/plugin-sdk/vitest-preset";

// This plugin lives inside the Termix (ncls) repository, and the SDK preset would
// then test against the core's source (a second copy of React, root
// dependencies). Keep the plugin standalone: point the SDK entries at the
// builds the installed SDK ships, exactly as when it sat in its own repository.
const here = path.dirname(fileURLToPath(import.meta.url));
const sdk = path.join(
  here,
  "node_modules",
  "@termix-ssh",
  "plugin-sdk",
  "dist",
);

export default pluginVitestConfig(import.meta.url, {
  alias: {
    "@termix-ssh/plugin-sdk/frontend": path.join(sdk, "frontend.js"),
    "@termix-ssh/plugin-sdk/ui": path.join(sdk, "host", "ui.js"),
    "@termix-ssh/plugin-host/testing": path.join(
      sdk,
      "host",
      "testing-host.js",
    ),
  },
});
