/** Isolated synthetic-image comparison. No Termix instance, real host or clipboard is accessed.
 * node scripts/benchmark-terminal-images.mjs /absolute/path/to/playwright-core/index.mjs
 */
import http from "node:http";
import { pathToFileURL } from "node:url";
import { transform } from "esbuild";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const helper = await readFile(
  new URL(
    "../plugins/ssh-terminal/src/frontend/terminal/clipboard-image.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiled = await transform(helper, {
  loader: "ts",
  format: "iife",
  globalName: "ClipboardImage",
});
const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.end("<!doctype html><title>Isolated terminal image benchmark</title>");
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const started = performance.now();
  const buffer = await sharp(Buffer.concat(chunks), {
    failOn: "error",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .png()
    .toBuffer();
  res.setHeader("Server-Timing", `decode;dur=${performance.now() - started}`);
  res.end(buffer);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.addScriptTag({ content: compiled.code });
  const results = await page.evaluate(async () => {
    const rows = [];
    const percentile = (samples, p) =>
      [...samples].sort((a, b) => a - b)[
        Math.min(samples.length - 1, Math.floor(samples.length * p))
      ];
    for (const [width, height] of [
      [1280, 720],
      [3840, 2160],
    ]) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#143f85");
      gradient.addColorStop(1, "#ddeb3c");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#fff8";
      ctx.font = "32px monospace";
      for (let y = 32; y < height; y += 64)
        ctx.fillText(`synthetic terminal fixture ${y}`, 12, y);
      for (const mime of ["image/jpeg", "image/png"]) {
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, mime),
        );
        let expected;
        for (const mode of ["before", "after"]) {
          const timings = [],
            preparation = [],
            bytes = [];
          for (let run = 0; run < 12; run++) {
            const begin = performance.now();
            let file;
            if (mode === "before" && mime !== "image/png") {
              const bitmap = await createImageBitmap(blob);
              const converted = document.createElement("canvas");
              converted.width = bitmap.width;
              converted.height = bitmap.height;
              converted.getContext("2d").drawImage(bitmap, 0, 0);
              bitmap.close();
              const png = await new Promise((resolve) =>
                converted.toBlob(resolve, "image/png"),
              );
              file = new File([png], "clipboard-image.png", {
                type: "image/png",
              });
            } else file = await ClipboardImage.clipboardImageFile(blob, mime);
            const prepared = performance.now();
            const response = await fetch("/normalize", {
              method: "POST",
              body: file,
            });
            if (!response.ok) throw new Error("Normalization failed");
            const output = await response.arrayBuffer();
            const decoded = await createImageBitmap(
              new Blob([output], { type: "image/png" }),
            );
            if (decoded.width !== width || decoded.height !== height)
              throw new Error("Dimensions changed");
            decoded.close();
            const hash = Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", output)),
            )
              .map((v) => v.toString(16).padStart(2, "0"))
              .join("");
            if (mode === "before") expected = hash;
            if (run > 1) {
              timings.push(performance.now() - begin);
              preparation.push(prepared - begin);
              bytes.push(file.size);
            }
            rows.push(
              ...(run === 11
                ? [
                    {
                      width,
                      height,
                      mime,
                      mode,
                      outputMatchesBaseline: hash === expected,
                    },
                  ]
                : []),
            );
          }
          Object.assign(rows.at(-1), {
            preparationP50: percentile(preparation, 0.5),
            preparationP95: percentile(preparation, 0.95),
            totalP50: percentile(timings, 0.5),
            totalP95: percentile(timings, 0.95),
            uploadBytes: bytes[0],
          });
        }
      }
    }
    return rows;
  });
  console.log(
    JSON.stringify(
      {
        scope:
          "loopback clipboard preparation + HTTP upload + Sharp normalization; excludes SFTP and application ingestion",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
