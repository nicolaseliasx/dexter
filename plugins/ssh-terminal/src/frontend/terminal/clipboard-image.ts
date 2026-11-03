/** The backend validates, rotates and normalizes raster uploads once with Sharp. */
export async function clipboardImageFile(
  blob: Blob,
  mimeType: string,
): Promise<File> {
  const extension =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/png"
        ? "png"
        : "image";
  const original = new File([blob], `clipboard-image.${extension}`, {
    type: mimeType,
  });
  // PNG stays byte-for-byte intact. JPEG can go directly to the same server-side
  // decoder as file uploads; other formats keep the existing browser fallback.
  if (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    typeof createImageBitmap !== "function"
  )
    return original;
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return original;
      context.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Image conversion failed")),
          "image/png",
        ),
      );
      return new File([png], "clipboard-image.png", { type: "image/png" });
    } finally {
      bitmap.close();
    }
  } catch {
    return original;
  }
}
