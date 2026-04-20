import type { DownloadService } from '../ports/DownloadService.js';

export class BrowserDownloadService implements DownloadService {
  trigger(bytes: Uint8Array | string, filename: string, mime: string): Promise<void> {
    const blobPart: BlobPart = bytes instanceof Uint8Array
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      : bytes;
    const blob = new Blob([blobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return Promise.resolve();
  }
}
