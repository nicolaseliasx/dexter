import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettings } from "@termix-ssh/plugin-sdk/frontend";
import { CustomCss } from "../src/frontend/CustomCss.js";

vi.mock("@termix-ssh/plugin-sdk/frontend", () => ({ useSettings: vi.fn() }));

function settings(css: unknown, enabled: unknown = true, loaded = true) {
  vi.mocked(useSettings).mockReturnValue({
    values: { css, enabled },
    loaded,
    save: vi.fn(),
  });
}

function styles() {
  return document.head.querySelectorAll(
    'style[data-termix-plugin="custom-css"]',
  );
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  settings("");
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("Custom CSS", () => {
  it("applies saved user CSS and also styles elements rendered later", () => {
    settings(".example { display: none; }");
    const { rerender } = render(<CustomCss />);
    expect(useSettings).toHaveBeenCalledWith("user");
    expect(styles()).toHaveLength(1);
    expect(styles()[0].textContent).toBe(".example { display: none; }");

    rerender(
      <>
        <CustomCss />
        <div className="example">Host tags</div>
      </>,
    );
    expect(getComputedStyle(document.querySelector(".example")!).display).toBe(
      "none",
    );
  });

  it("replaces saved CSS, then removes it when disabled without changing the setting", () => {
    settings(".example { display: none; }");
    const { rerender } = render(<CustomCss />);
    settings(".example { opacity: 0.5; }");
    rerender(<CustomCss />);
    expect(styles()).toHaveLength(1);
    expect(styles()[0].textContent).toBe(".example { opacity: 0.5; }");

    settings(".example { opacity: 0.5; }", false);
    rerender(<CustomCss />);
    expect(styles()).toHaveLength(0);
    expect(
      vi.mocked(useSettings).mock.results.at(-1)!.value.save,
    ).not.toHaveBeenCalled();
  });

  it("removes styles on unmount, including React Strict Mode remounts", () => {
    settings(".example { display: none; }");
    const { unmount } = render(
      <StrictMode>
        <CustomCss />
      </StrictMode>,
    );
    expect(styles()).toHaveLength(1);
    unmount();
    expect(styles()).toHaveLength(0);
  });

  it.each([
    ["", true, true],
    ["  \n  ", true, true],
    ["body { display: none; }", false, true],
    ["body { display: none; }", true, false],
    [123, true, true],
    ["body { display: none; }", "true", true],
  ])(
    "does not inject empty, disabled, unloaded or malformed settings (%j, %j, %j)",
    (css, enabled, loaded) => {
      settings(css, enabled, loaded);
      render(<CustomCss />);
      expect(styles()).toHaveLength(0);
    },
  );

  it("clears existing styles when CSS is erased or the settings become unloaded", () => {
    settings("body { color: red; }");
    const { rerender } = render(<CustomCss />);
    settings("");
    rerender(<CustomCss />);
    expect(styles()).toHaveLength(0);
    settings("body { color: red; }");
    rerender(<CustomCss />);
    expect(styles()).toHaveLength(1);
    settings("body { color: red; }", true, false);
    rerender(<CustomCss />);
    expect(styles()).toHaveLength(0);
  });

  it("bypasses saved CSS from the first render with ?custom-css=off, without deleting it", () => {
    window.history.replaceState(
      null,
      "",
      "/?other=value&custom-css=off#settings",
    );
    settings("body { display: none !important; }");
    const { rerender } = render(<CustomCss />);
    expect(styles()).toHaveLength(0);
    settings("* { display: none !important; }");
    rerender(<CustomCss />);
    expect(styles()).toHaveLength(0);
    expect(
      vi.mocked(useSettings).mock.results.at(-1)!.value.save,
    ).not.toHaveBeenCalled();
  });

  it("treats CSS as text, including strings containing HTML", () => {
    const css =
      '.example::after { content: "</style><script>window.injected = true</script>"; }';
    settings(css);
    render(<CustomCss />);
    expect(styles()).toHaveLength(1);
    expect(styles()[0].textContent).toBe(css);
    expect(document.querySelector("script")).toBeNull();
  });
});
