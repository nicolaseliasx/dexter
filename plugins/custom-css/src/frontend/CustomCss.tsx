import { useEffect } from "react";
import { useSettings } from "@termix-ssh/plugin-sdk/frontend";

export function CustomCss() {
  const { values, loaded } = useSettings("user");
  const { css, enabled } = values;
  const suspended =
    new URLSearchParams(window.location.search).get("custom-css") === "off";

  useEffect(() => {
    if (
      suspended ||
      !loaded ||
      enabled !== true ||
      typeof css !== "string" ||
      !css.trim()
    ) {
      return;
    }

    const style = document.createElement("style");
    style.dataset.termixPlugin = "custom-css";
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
  }, [css, enabled, loaded, suspended]);

  return null;
}
