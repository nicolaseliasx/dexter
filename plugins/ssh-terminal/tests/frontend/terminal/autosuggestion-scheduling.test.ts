// @vitest-environment node
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = ts.createSourceFile(
  "Terminal.tsx",
  fs.readFileSync(
    new URL("../../../src/frontend/terminal/Terminal.tsx", import.meta.url),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let scheduleSource = "";
let cleanupSource = "";
function visit(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === "scheduleAutosuggestionUpdate"
  ) {
    scheduleSource = (
      node.initializer as ts.CallExpression
    ).arguments[0].getText(source);
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(source) === "useEffect" &&
    node.arguments[0]
      ?.getText(source)
      .includes("cancelAnimationFrame(autosuggestionFrameRef.current)")
  ) {
    cleanupSource = node.arguments[0].getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!scheduleSource) throw new Error("Missing autosuggestion scheduler");

function setup() {
  const pending = new Map<number, FrameRequestCallback>();
  let id = 0;
  const update = vi.fn();
  const context = {
    autosuggestionFrameRef: { current: null as number | null },
    updateAutosuggestion: update,
    window: {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        pending.set(++id, callback);
        return id;
      },
      cancelAnimationFrame: (frame: number) => pending.delete(frame),
    },
  };
  const schedule = vm.runInNewContext(
    `(${scheduleSource})`,
    context,
  ) as () => void;
  const cleanup = cleanupSource
    ? (vm.runInNewContext(`(${cleanupSource})()`, context) as () => void)
    : () => {};
  const frame = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(0));
  };
  return { schedule, cleanup, pending, frame, update };
}

describe("terminal autosuggestion scheduling", () => {
  it("bounds pending work while animation frames are suspended in a background tab", () => {
    const state = setup();
    for (let i = 0; i < 10_000; i++) state.schedule();
    expect(state.pending.size).toBe(1);
    expect(state.update).not.toHaveBeenCalled();
    state.frame();
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.pending.size).toBe(0);
  });

  it("updates again when more output arrives after the previous frame", () => {
    const state = setup();
    state.schedule();
    state.frame();
    state.schedule();
    expect(state.pending.size).toBe(1);
    state.frame();
    expect(state.update).toHaveBeenCalledTimes(2);
  });

  it("cancels pending work when the terminal unmounts", () => {
    const state = setup();
    state.schedule();
    state.cleanup();
    expect(state.pending.size).toBe(0);
    state.frame();
    expect(state.update).not.toHaveBeenCalled();
  });
});
