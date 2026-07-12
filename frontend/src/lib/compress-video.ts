"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  VIDEO_COMPRESS_THRESHOLD,
  formatFileSize,
  mediaKind,
  validateMediaFiles,
} from "@/lib/media-validation";

type ProgressCb = (ratio: number) => void;
type StatusCb = (message: string) => void;

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function getFFmpeg(onProgress?: ProgressCb): Promise<FFmpeg> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      onProgress(Math.min(1, Math.max(0, progress || 0)));
    });
  }
  if (ffmpeg.loaded) return ffmpeg;
  if (!loading) {
    loading = (async () => {
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg!.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg!;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

function inputExt(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".mov")) return ".mov";
  if (name.endsWith(".webm")) return ".webm";
  if (name.endsWith(".mp4")) return ".mp4";
  if (file.type === "video/quicktime") return ".mov";
  if (file.type === "video/webm") return ".webm";
  return ".mp4";
}

/**
 * Re-encode large videos in the browser (scale ≤1280px, H.264) before upload.
 * Skips files under the threshold. Falls back to the original on failure.
 */
export async function compressVideoIfNeeded(
  file: File,
  opts?: { onStatus?: StatusCb; onProgress?: ProgressCb }
): Promise<File> {
  if (mediaKind(file) !== "video") return file;
  if (file.size <= VIDEO_COMPRESS_THRESHOLD) return file;

  const originalSize = file.size;
  opts?.onStatus?.(`Compressing ${file.name} (${formatFileSize(originalSize)})…`);

  try {
    const ff = await getFFmpeg(opts?.onProgress);
    const inName = `input${inputExt(file)}`;
    const outName = "output.mp4";

    await ff.writeFile(inName, await fetchFile(file));
    await ff.exec([
      "-i",
      inName,
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "ultrafast",
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      outName,
    ]);

    const data = await ff.readFile(outName);
    try {
      await ff.deleteFile(inName);
      await ff.deleteFile(outName);
    } catch {
      /* ignore cleanup errors */
    }

    const bytes =
      data instanceof Uint8Array
        ? data
        : new TextEncoder().encode(String(data));
    // Copy into a fresh ArrayBuffer-backed Uint8Array for Blob compatibility.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: "video/mp4" });
    const base = file.name.replace(/\.[^.]+$/, "") || "video";
    const compressed = new File([blob], `${base}-compressed.mp4`, {
      type: "video/mp4",
      lastModified: Date.now(),
    });

    if (compressed.size > 0 && compressed.size < originalSize) {
      opts?.onStatus?.(
        `Compressed ${file.name}: ${formatFileSize(originalSize)} → ${formatFileSize(compressed.size)}`
      );
      return compressed;
    }
    opts?.onStatus?.(`Kept original ${file.name} (already small enough after encode).`);
    return file;
  } catch {
    opts?.onStatus?.(
      `Could not compress ${file.name} in this browser. Using original if under 100 MB.`
    );
    return file;
  }
}

/** Compress large videos in a list, then validate against upload limits. */
export async function prepareMediaFiles(
  files: File[],
  opts?: { onStatus?: StatusCb; onProgress?: ProgressCb }
): Promise<{ files: File[]; error: string | null }> {
  const pre = validateMediaFiles(files, { allowOversizedVideoSource: true });
  if (pre) return { files: [], error: pre };

  const prepared: File[] = [];
  for (const file of files) {
    prepared.push(await compressVideoIfNeeded(file, opts));
  }
  return { files: prepared, error: validateMediaFiles(prepared) };
}
