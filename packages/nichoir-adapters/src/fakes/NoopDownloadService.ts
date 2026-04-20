import type { DownloadService } from '../ports/DownloadService.js';

export interface NoopDownloadCall {
  bytes: Uint8Array | string;
  filename: string;
  mime: string;
}

/**
 * Fake non-browser pour les tests : collecte les appels dans `calls` sans rien télécharger.
 * Permet des assertions de type "export a déclenché un download avec ce filename/mime".
 */
export class NoopDownloadService implements DownloadService {
  readonly calls: NoopDownloadCall[] = [];

  trigger(bytes: Uint8Array | string, filename: string, mime: string): Promise<void> {
    this.calls.push({ bytes, filename, mime });
    return Promise.resolve();
  }

  reset(): void {
    this.calls.length = 0;
  }
}
