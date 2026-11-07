import { describe, expect, it } from "vitest";
import { findSplitUrlLink } from "../../../src/frontend/terminal/split-url-links";

// Codex hard-wraps a URL inside a table cell, so xterm sees two unrelated rows.
const TABLE = [
  "  Free My TV (https://github.com/            5.955  Mais po",
  "  simbasjungles/free-my-tv)                         mantem",
];

describe("findSplitUrlLink", () => {
  it("joins a URL that a table cell wrapped onto the next row", () => {
    expect(findSplitUrlLink(TABLE, 0)).toEqual({
      url: "https://github.com/simbasjungles/free-my-tv",
      startRow: 0,
      startCol: 14,
      endRow: 1,
      endCol: 26,
    });
  });

  it("leaves the closing parenthesis out of the continuation", () => {
    const link = findSplitUrlLink(
      [
        "  Hearth (https://github.com/rudra-avatar/  337  Forte",
        "  Hearth)                                        simples",
      ],
      0,
    );
    expect(link?.url).toBe("https://github.com/rudra-avatar/Hearth");
  });

  it("does not join prose that merely ends in a URL", () => {
    expect(
      findSplitUrlLink(["see https://github.com/foo/", "next sentence"], 0),
    ).toBeUndefined();
  });

  it("does not join when the next row has nothing in the cell column", () => {
    expect(
      findSplitUrlLink(
        [
          "  Free (https://github.com/   5.955  Mais",
          "                              x",
        ],
        0,
      ),
    ).toBeUndefined();
  });

  it("ignores a URL that already ends with closing punctuation", () => {
    expect(
      findSplitUrlLink(
        ["  A (https://github.com/a/b)   1  x", "  extra   y"],
        0,
      ),
    ).toBeUndefined();
  });
});
