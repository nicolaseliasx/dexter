/// <reference types="vite/client" />
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import sourceText from "../../../src/frontend/terminal/Terminal.tsx?raw";

const source = ts.createSourceFile(
  "Terminal.tsx",
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let performFit = "";
function visit(node: ts.Node) {
  if (
    ts.isFunctionDeclaration(node) &&
    node.name?.text === "performFit"
  )
    performFit = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
if (!performFit) throw new Error("Missing performFit");

/**
 * The ResizeObserver is created once, so the performFit it calls keeps the
 * `isVisible` of that first render. Visibility has to come from the ref.
 */
const create = new Function(
  "state",
  ts.transpileModule(
    `
  const { terminal, fitAddonRef, isVisibleRef } = state;
  const isFittingRef = { current: false };
  const lastFittedSizeRef = { current: null };
  const setIsFitted = () => {};
  const scheduleNotify = () => {};
  function fitTerminal() { fitAddonRef.current?.fit(); }
  ${performFit}
  return performFit;
`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
) as (state: Record<string, unknown>) => () => void;

function run(isVisible: boolean, refVisible: boolean) {
  const fit = vi.fn();
  const perform = create({
    terminal: { cols: 80, rows: 24 },
    fitAddonRef: { current: { fit } },
    isVisible,
    isVisibleRef: { current: refVisible },
  });
  perform();
  return fit;
}

describe("performFit", () => {
  it("fits a terminal that became visible after its observer was created", () => {
    expect(run(false, true)).toHaveBeenCalledTimes(1);
  });

  it("does not fit while the terminal is hidden", () => {
    expect(run(true, false)).not.toHaveBeenCalled();
  });
});
