// Draws a labelled 10-pt grid and every SHEET_FIELDS box, with sample Caveat text, over the character sheet, into
// ../.superpowers/calibrated.pdf (git-ignored). Caveat's contextual alternates (calt) render as blank glyphs, so they
// are turned off. Compare it with Source Material/Example_Character_filled_in.pdf.
// Run from web/: node scripts/calibrate-sheet.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const bundle = await build({
  entryPoints: ['src/app/character/pdf/sheet-fields.ts'], bundle: true, write: false, format: 'esm', logLevel: 'error',
});
const { SHEET_FIELDS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const doc = await PDFDocument.load(await readFile('public/character-sheet.pdf'));
doc.registerFontkit(fontkit);
const hand = await doc.embedFont(await readFile('public/fonts/Caveat-Regular.ttf'), { subset: true, features: { calt: false } });
const label = await doc.embedFont(StandardFonts.Helvetica);
const page = doc.getPage(0);
const { width, height } = page.getSize();

const blue = rgb(0.1, 0.3, 0.9);
for (let x = 0; x <= width; x += 10) {
  page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, thickness: x % 50 ? 0.1 : 0.4, color: blue, opacity: 0.5 });
  if (x % 50 === 0) page.drawText(String(x), { x: x + 1, y: 2, size: 5, font: label, color: blue });
}
for (let y = 0; y <= height; y += 10) {
  page.drawLine({ start: { x: 0, y }, end: { x: width, y }, thickness: y % 50 ? 0.1 : 0.4, color: blue, opacity: 0.5 });
  if (y % 50 === 0) page.drawText(String(y), { x: 2, y: y + 1, size: 5, font: label, color: blue });
}

const red = rgb(0.85, 0.1, 0.1);
for (const [field, box] of Object.entries(SHEET_FIELDS)) {
  const lines = box.lines ?? 1;
  for (let i = 0; i < lines; i++) {
    const y = box.y - i * (box.lineHeight ?? 0);
    page.drawRectangle({ x: box.x, y, width: box.width, height: box.size * 0.7, borderColor: red, borderWidth: 0.4 });
    const sample = /level|skill:|attribute:|rating|Max|movement|encumbrance|damage|durability|grip|range|money/.test(field) ? '14' : field;
    const x = box.align === 'center' ? box.x + (box.width - hand.widthOfTextAtSize(sample, box.size)) / 2 : box.x;
    page.drawText(sample, { x, y, size: box.size, font: hand, color: red });
  }
}

await writeFile('../.superpowers/calibrated.pdf', await doc.save());
console.log(`Drew ${Object.keys(SHEET_FIELDS).length} fields onto ../.superpowers/calibrated.pdf`);
