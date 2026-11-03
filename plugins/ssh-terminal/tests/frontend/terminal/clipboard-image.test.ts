import { describe, expect, it, vi } from "vitest";
import { clipboardImageFile } from "../../../src/frontend/terminal/clipboard-image";

describe("clipboard image handoff", () => {
  it("passes the original raster bytes to server validation, avoiding a second image conversion", async () => {
    const bitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    try {
      const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x01])], {
        type: "image/jpeg",
      });
      const file = await clipboardImageFile(blob, "image/jpeg");
      expect(file.type).toBe("image/jpeg");
      expect(file.size).toBe(blob.size);
      expect(bitmap).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("preserves the existing canvas fallback for formats the server does not accept", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 2, height: 2, close })),
    );
    const draw = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage: vi.fn() } as never);
    const encode = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb) => cb(new Blob(["png"], { type: "image/png" })));
    try {
      const file = await clipboardImageFile(
        new Blob(["svg"], { type: "image/svg+xml" }),
        "image/svg+xml",
      );
      expect(file.type).toBe("image/png");
      expect(close).toHaveBeenCalledOnce();
    } finally {
      draw.mockRestore();
      encode.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
