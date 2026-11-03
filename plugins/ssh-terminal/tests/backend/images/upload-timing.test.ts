import { describe, expect, it } from "vitest";
import { imageUploadTimings } from "../../../src/backend/images/upload-timing.js";
describe("image upload timing", () => {
  it("reports separate stages using a monotonic clock without including image data", () => {
    let time = 10;
    const timing = imageUploadTimings(() => time);
    time = 12;
    timing.mark("settings");
    time = 18;
    timing.mark("decode");
    expect(timing.header()).toBe("settings;dur=2.0, decode;dur=6.0");
    expect(timing.durations).toEqual({ settings: 2, decode: 6 });
  });
});
