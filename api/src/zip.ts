import zlib from "zlib";

// Lettore ZIP minimo per i temi caricati dalla console: solo archivi normali (non ZIP64, non cifrati),
// file salvati senza compressione o con deflate. Legge l'indice centrale, non si fida dei nomi:
// chi chiama controlla i percorsi. I limiti fermano gli archivi «bomba» prima di decomprimere troppo.

export type ZipEntry = { name: string; data: Buffer };
export type ZipLimits = { maxFiles: number; maxTotalBytes: number; maxFileBytes: number };

export class ZipError extends Error {}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export function readZip(buf: Buffer, limits: ZipLimits): ZipEntry[] {
  // Fine dell'indice centrale: negli ultimi 22 + 65535 byte (commento facoltativo).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError("Il file non è uno ZIP valido");
  const count = buf.readUInt16LE(eocd + 10);
  const cenSize = buf.readUInt32LE(eocd + 12);
  let p = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cenSize === 0xffffffff || p === 0xffffffff) throw new ZipError("Gli archivi ZIP64 non sono supportati");
  if (count > limits.maxFiles) throw new ZipError(`Troppi file nell'archivio (massimo ${limits.maxFiles})`);
  if (p + cenSize > buf.length) throw new ZipError("Il file ZIP è incompleto");

  const out: ZipEntry[] = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) throw new ZipError("Indice dello ZIP non valido");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttr = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString(flags & 0x800 ? "utf8" : "latin1");
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue; // cartella
    if (flags & 0x1) throw new ZipError(`File cifrato nello ZIP: ${name}`);
    // Collegamenti simbolici (attributi Unix 0o120000): mai.
    if (((externalAttr >>> 16) & 0o170000) === 0o120000) throw new ZipError(`Collegamento simbolico non ammesso: ${name}`);
    if (size > limits.maxFileBytes) throw new ZipError(`File troppo grande nello ZIP: ${name}`);
    total += size;
    if (total > limits.maxTotalBytes) throw new ZipError("Contenuto dello ZIP troppo grande una volta estratto");

    if (buf.readUInt32LE(localOffset) !== LOC_SIG) throw new ZipError(`Voce dello ZIP non valida: ${name}`);
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(start, start + compSize);
    if (raw.length !== compSize) throw new ZipError(`Voce dello ZIP incompleta: ${name}`);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) });
      } catch {
        throw new ZipError(`Voce dello ZIP danneggiata: ${name}`);
      }
    } else throw new ZipError(`Compressione non supportata (${method}) per ${name}: usa uno ZIP normale`);
    if (data.length !== size) throw new ZipError(`Dimensione non coerente nello ZIP: ${name}`);
    out.push({ name, data });
  }
  return out;
}
