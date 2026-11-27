import { InjectionToken } from '@angular/core';

export interface SheetAssets {
  /** Page 2 of DB-Character-Sheet.pdf. */
  sheet: ArrayBuffer;
  /** Caveat, the handwriting. */
  font: ArrayBuffer;
  /** Colus, for the description pages' headings. */
  heading: ArrayBuffer;
  /** The scroll tile as PNG (pdf-lib embeds PNG and JPG only). */
  parchment: ArrayBuffer;
}

/**
 * Loads the sheet, the fonts and the parchment when a PDF is made. Injectable so tests hand in bytes; apart from
 * `sheet-pdf.ts` so the export menu can load pdf-lib only when a PDF is asked for.
 */
export const SHEET_ASSETS = new InjectionToken<() => Promise<SheetAssets>>('SHEET_ASSETS', { factory: () => loadSheetAssets });

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
}

async function loadSheetAssets(): Promise<SheetAssets> {
  const bytes = (url: string) => fetchOk(url).then(r => r.arrayBuffer());
  const [sheet, font, heading, parchment] = await Promise.all([
    bytes('/character-sheet.pdf'), bytes('/fonts/Caveat-Regular.ttf'), bytes('/Colus.otf'),
    fetchOk('/scroll-tile.webp').then(r => r.blob()).then(toPng),
  ]);
  return { sheet, font, heading, parchment };
}

async function toPng(image: Blob): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(image);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
}
