export interface DownloadService {
  /** Déclenche le téléchargement de `bytes` sous le nom `filename`
   *  avec le type MIME donné.
   *  L'implémentation browser crée un Blob + <a download>. */
  trigger(
    bytes: Uint8Array | string,
    filename: string,
    mime: string
  ): Promise<void>;
}
