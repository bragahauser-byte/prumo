/**
 * Reduz uma foto escolhida pelo usuário para um quadrado de `size` px (corte central) em JPEG.
 * O resultado fica pequeno o bastante para ser guardado junto das preferências.
 */
export async function photoToAvatarDataUrl(file: File, size = 256, quality = 0.85): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-image");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error("empty-image");
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no-canvas");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
