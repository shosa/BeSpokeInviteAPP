import { execFile } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// Pipeline dei file caricati dai clienti (foto, video, audio): ogni file passa da ffmpeg prima di essere salvato.
// Il video diventa H.264 muto e ridotto, l'audio MP3 a 128 kbps. La foto diventa JPEG con il lato lungo massimo di 2200 px;
// PNG e WebP restano PNG, così la trasparenza non diventa uno sfondo nero o bianco.
// Le conversioni sono in coda, una alla volta, con priorità bassa: il server è condiviso con altri servizi.

export const MEDIA_DIR = process.env.MEDIA_DIR ?? path.join(process.cwd(), "data", "media");
const TMP_DIR = path.join(MEDIA_DIR, "tmp");

export type MediaKind = "photo" | "video" | "audio";

export const MEDIA_LIMITS: Record<MediaKind, { inputBytes: number; outputBytes: number; maxSeconds: number }> = {
  photo: { inputBytes: 30 * 1024 * 1024, outputBytes: 3 * 1024 * 1024, maxSeconds: 0 },
  // PNG con trasparenza: più pesante del JPEG, stesso lato massimo.

  video: { inputBytes: 150 * 1024 * 1024, outputBytes: 15 * 1024 * 1024, maxSeconds: 90 },
  audio: { inputBytes: 40 * 1024 * 1024, outputBytes: 6 * 1024 * 1024, maxSeconds: 600 },
};

const EXT: Record<MediaKind, string> = { photo: "jpg", video: "mp4", audio: "mp3" };

export class MediaError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

let queue: Promise<unknown> = Promise.resolve();

// Ogni conversione aspetta la precedente. Niente due ffmpeg insieme sullo stesso server.
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export function ensureMediaDirs() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Converte un file caricato e lo salva in MEDIA_DIR. Ritorna il nome del file e l'URL pubblico.
export async function convertMedia(kind: MediaKind, input: Buffer, inputExt: string): Promise<{ name: string; url: string; bytes: number }> {
  const limits = MEDIA_LIMITS[kind];
  if (input.length > limits.inputBytes) throw new MediaError(`File troppo grande (massimo ${Math.round(limits.inputBytes / 1048576)} MB)`, 413);
  return serial(() => run(kind, input, inputExt, limits));
}

async function run(kind: MediaKind, input: Buffer, inputExt: string, limits: (typeof MEDIA_LIMITS)[MediaKind]) {
  ensureMediaDirs();
  const id = randomUUID();
  const src = path.join(TMP_DIR, `${id}.${inputExt}`);
  const outExt = keepsAlpha(kind, inputExt) ? "png" : EXT[kind];
  const outLimit = outExt === "png" ? PNG_OUTPUT_BYTES : limits.outputBytes;
  const out = path.join(MEDIA_DIR, `${id}.${outExt}`);
  fs.writeFileSync(src, input);
  try {
    if (limits.maxSeconds) {
      const seconds = await probeDuration(src);
      if (seconds > limits.maxSeconds) throw new MediaError(`Durata troppo lunga (massimo ${limits.maxSeconds} secondi)`);
    }
    await ffmpeg(args(kind, src, out));
    const bytes = fs.statSync(out).size;
    if (bytes > outLimit) {
      fs.rmSync(out, { force: true });
      throw new MediaError(`Il file convertito è troppo grande (massimo ${Math.round(outLimit / 1048576)} MB): usane uno più corto o più leggero`);
    }
    return { name: path.basename(out), url: `/api/media/${path.basename(out)}`, bytes };
  } catch (e) {
    fs.rmSync(out, { force: true });
    if (e instanceof MediaError) throw e;
    throw new MediaError("File non leggibile o formato non supportato", 422);
  } finally {
    fs.rmSync(src, { force: true });
  }
}

const PNG_OUTPUT_BYTES = 8 * 1024 * 1024;

// Le foto con trasparenza (PNG, WebP) restano senza perdere il canale alfa.
function keepsAlpha(kind: MediaKind, inputExt: string): boolean {
  return kind === "photo" && (inputExt === "png" || inputExt === "webp");
}

function args(kind: MediaKind, src: string, out: string): string[] {
  const base = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-threads", "2", "-i", src];
  if (kind === "video") {
    return [...base, "-an", "-vf", "scale='min(1080,iw)':-2", "-c:v", "libx264", "-preset", "slower", "-crf", "29", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out];
  }
  if (kind === "audio") return [...base, "-vn", "-c:a", "libmp3lame", "-b:a", "128k", out];
  const scale = "scale='min(2200,iw)':'min(2200,ih)':force_original_aspect_ratio=decrease";
  if (keepsAlpha(kind, path.extname(src).slice(1).toLowerCase())) return [...base, "-an", "-vf", scale, "-compression_level", "9", out];
  return [...base, "-an", "-vf", scale, "-q:v", "3", out];
}

// Miniatura JPEG di un'immagine (es. la busta chiusa di un tema), larga `width` px. Passa dalla stessa coda delle conversioni.
export function makeThumbnail(src: string, out: string, width: number): Promise<void> {
  return serial(() => ffmpeg(["-y", "-loglevel", "error", "-i", src, "-vf", `scale=${width}:-2:flags=lanczos`, "-q:v", "4", out]));
}

// "nice -n 19" lascia la CPU agli altri servizi: la conversione è lenta ma non deve rallentare il resto.
function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("nice", ["-n", "19", "ffmpeg", ...args], { timeout: 240_000, maxBuffer: 1024 * 1024 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { timeout: 30_000 },
      (err, stdout) => {
        if (err) return reject(new MediaError("File non leggibile o formato non supportato", 422));
        const seconds = Number(String(stdout).trim());
        if (!Number.isFinite(seconds)) reject(new MediaError("Durata non leggibile", 422));
        else resolve(seconds);
      },
    );
  });
}

// Tipo e estensione di partenza ammessi per ciascun tipo di media.
export const INPUT_TYPES: Record<MediaKind, Record<string, string>> = {
  photo: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" },
  video: { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-matroska": "mkv" },
  audio: { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav" },
};
