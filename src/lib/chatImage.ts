/**
 * Gets a picked or pasted image ready to send in chat: phone photos are shrunk to at most
 * MAX_SIDE pixels and re-saved as JPEG, so a 10 MB photo goes up as a few hundred KB. Small
 * images and GIFs (which would lose their animation) go as they are. The server accepts JPEG,
 * PNG, GIF and WebP up to MAX_IMAGE_BYTES (ChatImages.MaxBytes on the backend).
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 1600;
// Already small enough to send without re-encoding.
const SEND_AS_IS_BYTES = 1024 * 1024;
const SENDABLE = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export type PreparedImage = { blob: Blob; name: string; width: number; height: number };

export class ChatImageError extends Error {}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    // Turns phone photos the right way up (EXIF orientation).
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sizeOf = (image: ImageBitmap | HTMLImageElement) =>
  "naturalWidth" in image ? { width: image.naturalWidth, height: image.naturalHeight } : { width: image.width, height: image.height };

export async function prepareChatImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new ChatImageError("Only images can be sent.");

  let image: ImageBitmap | HTMLImageElement;
  try {
    image = await decode(file);
  } catch {
    throw new ChatImageError("Couldn't read that image. Try a JPEG or PNG.");
  }
  const { width, height } = sizeOf(image);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));

  const sendAsIs =
    file.type === "image/gif" || (scale === 1 && file.size <= SEND_AS_IS_BYTES && SENDABLE.includes(file.type));
  if (sendAsIs) {
    if ("close" in image) image.close();
    if (file.size > MAX_IMAGE_BYTES) throw new ChatImageError("That image is too big to send (8 MB at most).");
    return { blob: file, name: file.name || "image", width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ChatImageError("Couldn't prepare that image.");
  // JPEG has no transparency: see-through parts of a PNG would otherwise turn black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ("close" in image) image.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new ChatImageError("Couldn't prepare that image.");
  if (blob.size > MAX_IMAGE_BYTES) throw new ChatImageError("That image is too big to send (8 MB at most).");
  const name = `${(file.name || "image").replace(/\.[^.]+$/, "")}.jpg`;
  return { blob, name, width: canvas.width, height: canvas.height };
}
