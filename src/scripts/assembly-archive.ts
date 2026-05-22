export interface AssemblyArchiveFile {
  url: string;
  filename: string;
}

interface AssemblyArchiveOptions {
  fetcher?: typeof fetch;
  now?: Date;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const VERSION_NEEDED = 20;
const DOS_EPOCH_YEAR = 1980;
const textEncoder = new TextEncoder();

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

export function setupAssemblyArchiveDownloads(root: ParentNode = document): void {
  const triggers = root.querySelectorAll<HTMLButtonElement>("[data-assembly-archive-files]");
  for (const trigger of triggers) {
    if (trigger.dataset.assemblyArchiveReady === "true") {
      continue;
    }
    trigger.dataset.assemblyArchiveReady = "true";
    trigger.addEventListener("click", () => {
      void downloadAssemblyArchive(trigger);
    });
  }
}

export async function createAssemblyArchiveBlob(
  files: AssemblyArchiveFile[],
  options: AssemblyArchiveOptions = {},
): Promise<Blob> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const downloaded = await Promise.all(
    files.map(async (file) => {
      const response = await fetcher(file.url);
      if (!response.ok) {
        throw new Error(`Could not fetch assembly asset ${file.url}: ${response.status}`);
      }
      return {
        filename: sanitizeArchiveFilename(file.filename),
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    }),
  );
  return new Blob([arrayBufferFromBytes(buildStoredZip(downloaded, now))], { type: "application/zip" });
}

async function downloadAssemblyArchive(trigger: HTMLButtonElement): Promise<void> {
  const files = archiveFilesFromTrigger(trigger);
  const filename = trigger.dataset.assemblyArchiveName || "recommended-assemblies.zip";
  const defaultLabel = trigger.dataset.labelDefault || trigger.textContent || "Download Assemblies";
  const busyLabel = trigger.dataset.labelBusy || "Preparing...";

  if (files.length === 0) {
    return;
  }

  trigger.disabled = true;
  trigger.textContent = busyLabel;
  try {
    const blob = await createAssemblyArchiveBlob(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    window.alert("Could not prepare the assembly download. Check that the assembly assets still exist.");
  } finally {
    trigger.disabled = false;
    trigger.textContent = defaultLabel;
  }
}

function archiveFilesFromTrigger(trigger: HTMLButtonElement): AssemblyArchiveFile[] {
  const raw = trigger.dataset.assemblyArchiveFiles;
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isAssemblyArchiveFile);
}

function isAssemblyArchiveFile(value: unknown): value is AssemblyArchiveFile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.url === "string" && typeof candidate.filename === "string";
}

function buildStoredZip(files: { filename: string; bytes: Uint8Array }[], now: Date): Uint8Array {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime(now);

  for (const file of files) {
    const name = textEncoder.encode(file.filename);
    const crc = crc32(file.bytes);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, LOCAL_FILE_HEADER_SIGNATURE, true);
    localView.setUint16(4, VERSION_NEEDED, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.bytes.byteLength, true);
    localView.setUint32(22, file.bytes.byteLength, true);
    localView.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    chunks.push(localHeader, file.bytes);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, CENTRAL_DIRECTORY_SIGNATURE, true);
    centralView.setUint16(4, VERSION_NEEDED, true);
    centralView.setUint16(6, VERSION_NEEDED, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.bytes.byteLength, true);
    centralView.setUint32(24, file.bytes.byteLength, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(name, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.byteLength + file.bytes.byteLength;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = byteLength(centralDirectory);
  chunks.push(...centralDirectory);

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, centralDirectoryOffset, true);
  chunks.push(endRecord);

  return concatBytes(chunks);
}

function sanitizeArchiveFilename(filename: string): string {
  const clean = filename
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return clean || "assembly";
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(value.getFullYear(), DOS_EPOCH_YEAR);
  return {
    dosDate: ((year - DOS_EPOCH_YEAR) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    dosTime: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
  };
}

function byteLength(chunks: Uint8Array[]): number {
  return chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(byteLength(chunks));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
