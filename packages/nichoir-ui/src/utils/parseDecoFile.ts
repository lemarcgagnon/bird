// src/utils/parseDecoFile.ts
//
// Port browser-local de `parseSVG` + `rasterizeToCanvas` de
// `src/geometry/deco.js:11-130`, fusionnés en une seule API publique :
//
//   parseDecoFile(file, targetHeightmapResolution) → Promise<DecoParseResult>
//
// Garde-fous codex P2.7b :
//   - Resample immédiat : le raster est généré à 256×256 en interne (fidélité
//     v15, pour les warnings/status "raster 256×256"), puis downsamplé à
//     `targetHeightmapResolution` avant retour. `heightmapData.length` est
//     donc toujours `targetRes² × 4` — aligné sur le contrat core
//     `buildDecoGeoHeightmap` (packages/nichoir-core/src/geometry/deco.ts:135).
//
//   - parseSVG **ne throw jamais**. Erreur de parsing SVG → `parsedShapes=null`
//     + `lastParseWarning` (DecoWarning structuré). Les seuls `throw` de
//     `parseDecoFile` sont :
//       1. extension non acceptée (validation upfront)
//       2. rasterisation échouée (img.onerror : image corrompue / SVG non
//          rasterizable / canvas 2D context indisponible)
//       3. FileReader reject (image corrompue en lecture)
//
//   - `lastParseWarning` stocké sous forme **structurée** `DecoWarning = { key, params? }`
//     (P3 fix "langue figée") : la traduction est faite au render dans le
//     composant consommateur (DecoModeSection) via `useT()`, pas au parse.
//     Conséquence : switch de langue répercuté sans re-parser le fichier.
//
// Limitations jsdom (tests) :
//   - `getTotalLength` / `getPointAtLength` non implémentés → SVG shapes
//     extraction retourne toujours warning `noShapes` en jsdom. Les tests
//     de parse SVG avec shapes réelles nécessitent des mocks ou un vrai
//     browser (passe navigateur codex).

'use client';

import type { ParsedShape, BBox, Pt2, DecoWarning } from '@nichoir/core';

/**
 * Taille fixe du raster intermédiaire (v15 src/ui/deco-panel.js:126, 144).
 * Exporté pour que DecoStatusSection puisse afficher la constante sans
 * la coupler à `heightmapData.length` (qui vit à `targetHeightmapResolution`
 * après downsample).
 */
export const RASTER_SOURCE_SIZE = 256;

const ACCEPTED_EXTENSION_RE = /\.(svg|png|jpe?g)$/i;
const ELEMENTS_SELECTOR = 'path,rect,circle,ellipse,polygon,polyline,line';

export interface DecoParseResult {
  source: string;                          // texte SVG brut ou dataURL image
  sourceType: 'svg' | 'image';
  parsedShapes: ParsedShape[] | null;      // null si SVG sans formes exploitables ou image
  bbox: BBox | null;
  heightmapData: Uint8ClampedArray;        // RGBA, length === targetRes² × 4
  heightmapResolution: number;             // === targetHeightmapResolution (synchro slot)
  mode: 'vector' | 'heightmap';
  lastParseWarning: DecoWarning | null;    // structuré (key + params), traduit au render
}

/**
 * Charge + parse un fichier de décor utilisateur (SVG / PNG / JPG), retourne
 * une structure prête à être mergée dans le slot via `setDecoSlot(key, { ...result, enabled: true })`.
 *
 * @param file Le fichier uploadé par l'utilisateur.
 * @param targetHeightmapResolution La résolution cible pour `heightmapData`
 *   (doit être un entier ∈ [16, 128], borne du contrat core). Typiquement
 *   `slot.resolution` du panneau actif au moment de l'upload.
 */
export async function parseDecoFile(
  file: File,
  targetHeightmapResolution: number,
): Promise<DecoParseResult> {
  if (!ACCEPTED_EXTENSION_RE.test(file.name)) {
    throw new Error(`Unsupported file extension: ${file.name}`);
  }

  const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';

  if (isSvg) {
    const svgText = await readAsText(file);
    const parsed = parseSvgShapes(svgText);
    const heightmapData = await rasterizeAndDownsample(svgText, 'svg', targetHeightmapResolution);
    const mode: 'vector' | 'heightmap' =
      parsed.shapes !== null && parsed.shapes.length > 0 ? 'vector' : 'heightmap';
    return {
      source: svgText,
      sourceType: 'svg',
      parsedShapes: parsed.shapes,
      bbox: parsed.bbox,
      heightmapData,
      heightmapResolution: targetHeightmapResolution,
      mode,
      lastParseWarning: parsed.warning,
    };
  }

  // PNG / JPG
  const dataUrl = await readAsDataURL(file);
  const heightmapData = await rasterizeAndDownsample(dataUrl, 'image', targetHeightmapResolution);
  return {
    source: dataUrl,
    sourceType: 'image',
    parsedShapes: null,
    bbox: null,
    heightmapData,
    heightmapResolution: targetHeightmapResolution,
    mode: 'heightmap',
    lastParseWarning: null,
  };
}

/**
 * Re-génère le heightmap d'un slot à une nouvelle résolution en re-rasterisant
 * `source` (texte SVG ou dataURL image) sans re-parser les shapes SVG.
 *
 * Utilisé par `DecoReliefSection` (P2.7c) au slide du slider resolution : le
 * raster 256 source n'est plus stocké dans le slot (décision P2.7b : resample
 * immédiat au parse), donc pour changer la taille du heightmap on re-rasterise
 * depuis `slot.source` qui persiste.
 *
 * Retourne un `Uint8ClampedArray` de taille `targetRes² × 4`, aligné sur le
 * contrat core `buildDecoGeoHeightmap` (nichoir-core/src/geometry/deco.ts:135).
 *
 * Throws si :
 *   - Canvas 2D context indisponible (jsdom sans canvas npm).
 *   - `img.onerror` pendant la re-rasterisation (source corrompue).
 */
export async function resampleHeightmapFromSource(
  source: string,
  sourceType: 'svg' | 'image',
  targetRes: number,
): Promise<Uint8ClampedArray> {
  return rasterizeAndDownsample(source, sourceType, targetRes);
}

// ---------------------------------------------------------------------------
// Internes — port fidèle src/geometry/deco.js
// ---------------------------------------------------------------------------

interface ParseSvgResult {
  shapes: ParsedShape[] | null;
  bbox: BBox | null;
  warning: DecoWarning | null;
}

/**
 * Port v15 de `parseSVG` (src/geometry/deco.js:11-67). Ne throw jamais :
 * les 3 cas d'échec retournent `{ shapes: null, bbox: null, warning: <DecoWarning structuré> }`.
 * Discrétisation via `getTotalLength` + `getPointAtLength` sur 120 samples par élément.
 * Le warning est traduit au render (DecoModeSection), pas ici.
 */
function parseSvgShapes(svgText: string): ParseSvgResult {
  let holder: HTMLDivElement | null = null;
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    if (doc.querySelector('parsererror') !== null) {
      return { shapes: null, bbox: null, warning: { key: 'deco.svg.malformed' } };
    }
    const svgEl = doc.documentElement;

    // Attache un clone au DOM pour que les méthodes SVG de layout soient dispo.
    holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-99999px;width:0;height:0;overflow:hidden';
    const clone = svgEl.cloneNode(true) as Element;
    holder.appendChild(clone);
    document.body.appendChild(holder);

    const N = 120;
    const shapes: ParsedShape[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const collect = (p: { x: number; y: number }): void => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    };

    const elements = clone.querySelectorAll(ELEMENTS_SELECTOR);
    elements.forEach((el) => {
      const anyEl = el as unknown as SVGGeometryElement;
      let length = 0;
      try { length = anyEl.getTotalLength(); } catch { return; }
      if (!length || !isFinite(length)) return;

      const tag = el.tagName.toLowerCase();
      const isClosed = tag !== 'polyline' && tag !== 'line';
      const pts: Pt2[] = [];
      let failed = false;
      for (let i = 0; i <= N; i++) {
        const tt = (i / N) * length;
        try {
          const p = anyEl.getPointAtLength(tt);
          pts.push({ x: p.x, y: p.y });
          collect(p);
        } catch { failed = true; break; }
      }
      if (failed || pts.length < 3) return;
      if (isClosed && pts.length > 0 && (pts[0]!.x !== pts[pts.length - 1]!.x || pts[0]!.y !== pts[pts.length - 1]!.y)) {
        // Ferme explicitement la shape pour cohérence (src v15 utilise shape.closePath()).
        pts.push({ x: pts[0]!.x, y: pts[0]!.y });
      }
      shapes.push(pts);
    });

    if (shapes.length === 0) {
      return { shapes: null, bbox: null, warning: { key: 'deco.svg.noShapes' } };
    }
    return { shapes, bbox: { minX, minY, maxX, maxY }, warning: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { shapes: null, bbox: null, warning: { key: 'deco.svg.parseError', params: { message } } };
  } finally {
    if (holder !== null && holder.parentNode !== null) {
      holder.parentNode.removeChild(holder);
    }
  }
}

/**
 * Charge `source` (texte SVG via blob ou dataURL image) dans un `<img>`, le
 * dessine sur un canvas 256×256 puis downsample à `targetRes`.
 * Throws si le canvas 2D context est indisponible ou si `img.onerror` se déclenche.
 */
async function rasterizeAndDownsample(
  source: string,
  sourceType: 'svg' | 'image',
  targetRes: number,
): Promise<Uint8ClampedArray> {
  const sourceCanvas = await rasterizeSource(source, sourceType, RASTER_SOURCE_SIZE);
  if (targetRes === RASTER_SOURCE_SIZE) {
    const ctx = sourceCanvas.getContext('2d');
    if (ctx === null) throw new Error('Canvas 2D context unavailable');
    return ctx.getImageData(0, 0, targetRes, targetRes).data;
  }
  const down = document.createElement('canvas');
  down.width = targetRes;
  down.height = targetRes;
  const dctx = down.getContext('2d');
  if (dctx === null) throw new Error('Canvas 2D context unavailable');
  dctx.drawImage(sourceCanvas, 0, 0, targetRes, targetRes);
  return dctx.getImageData(0, 0, targetRes, targetRes).data;
}

/**
 * Port v15 de `rasterizeToCanvas` (src/geometry/deco.js:70-116). Retourne
 * un canvas `size × size` avec fond blanc + image dessinée en stretch full.
 */
async function rasterizeSource(
  source: string,
  sourceType: 'svg' | 'image',
  size: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let blobUrl: string | null = null;
    const cleanup = (): void => {
      if (blobUrl !== null) URL.revokeObjectURL(blobUrl);
    };

    img.onload = (): void => {
      cleanup();
      const cv = document.createElement('canvas');
      cv.width = size;
      cv.height = size;
      const ctx = cv.getContext('2d');
      if (ctx === null) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      // Letterbox — port fidèle v15 (src/geometry/deco.js:84-89).
      // Sans ça, PNG/JPG non-carrés et SVG non-carrés rasterisent déformés
      // → heightmap biaisé → géométrie déco ne match pas le comportement
      // historique (finding codex P2.7b).
      const ar = img.width / img.height;
      let dw = size;
      let dh = size;
      if (ar > 1) dh = size / ar;
      else if (ar < 1) dw = size * ar;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      resolve(cv);
    };
    img.onerror = (): void => {
      cleanup();
      reject(new Error('Image load failed'));
    };

    if (sourceType === 'svg') {
      const blob = new Blob([source], { type: 'image/svg+xml' });
      blobUrl = URL.createObjectURL(blob);
      img.src = blobUrl;
    } else {
      img.src = source;
    }
  });
}

async function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (): void => resolve(r.result as string);
    r.onerror = (): void => reject(new Error('FileReader failed'));
    r.readAsDataURL(file);
  });
}

async function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (): void => resolve(r.result as string);
    r.onerror = (): void => reject(new Error('FileReader failed'));
    r.readAsText(file);
  });
}
