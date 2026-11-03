import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { clipboardImageFile } from "../../../src/frontend/terminal/clipboard-image.js";

describe("clipboard handoff through the real server image decoder", () => {
  it("keeps PNG bytes and transparent pixels intact", async () => {
    const pixels = Buffer.from([255, 0, 0, 0, 0, 255, 0, 128, 0, 0, 255, 255]);
    const png = await sharp(pixels, {
      raw: { width: 3, height: 1, channels: 4 },
    })
      .png()
      .toBuffer();
    const file = await clipboardImageFile(new Blob([png]), "image/png");
    const uploaded = Buffer.from(await file.arrayBuffer());
    expect(uploaded.equals(png)).toBe(true);
    const decoded = await sharp(uploaded, { failOn: "error" })
      .rotate()
      .png()
      .raw()
      .toBuffer();
    expect(decoded.equals(pixels)).toBe(true);
  });
  it("retains JPEG orientation and decoded color through existing Sharp normalization", async () => {
    const jpeg = await sharp({
      create: {
        width: 48,
        height: 32,
        channels: 3,
        background: { r: 200, g: 40, b: 70 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const file = await clipboardImageFile(new Blob([jpeg]), "image/jpeg");
    const normalized = await sharp(Buffer.from(await file.arrayBuffer()), {
      failOn: "error",
    })
      .rotate()
      .png()
      .toBuffer();
    const metadata = await sharp(normalized).metadata();
    expect([metadata.width, metadata.height]).toEqual([32, 48]);
    const actual = await sharp(normalized).raw().toBuffer();
    const expected = await sharp(jpeg).rotate().raw().toBuffer();
    expect(actual.equals(expected)).toBe(true);
  });
});
