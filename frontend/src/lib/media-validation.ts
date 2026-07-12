/** Matches backend `app.services.storage` limits. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_MEDIA_FILES = 12;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm"]);

export type MediaKind = "image" | "video";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function mediaKind(file: File): MediaKind | null {
  if (IMAGE_TYPES.has(file.type) || IMAGE_EXTS.has(extOf(file.name))) return "image";
  if (VIDEO_TYPES.has(file.type) || VIDEO_EXTS.has(extOf(file.name))) return "video";
  return null;
}

/** Returns an error message, or null if all files are valid. */
export function validateMediaFiles(files: File[]): string | null {
  if (files.length > MAX_MEDIA_FILES) {
    return `You can upload up to ${MAX_MEDIA_FILES} files.`;
  }
  for (const file of files) {
    const kind = mediaKind(file);
    if (!kind) {
      return `"${file.name}" is not a supported image or video. Use JPG, PNG, WebP, HEIC, MP4, MOV, or WebM.`;
    }
    const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    const label = kind === "image" ? "25 MB" : "100 MB";
    if (file.size > max) {
      return `"${file.name}" is too large. Max ${label} for ${kind}s.`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty.`;
    }
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
