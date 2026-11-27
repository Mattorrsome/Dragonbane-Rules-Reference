// One-off: copies page 2 (the easy-print version) of the official sheet into public/.
// Run from web/: node scripts/extract-sheet-page.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

const source = await PDFDocument.load(await readFile('../Source Material/DB-Character-Sheet.pdf'));
const out = await PDFDocument.create();
const [page] = await out.copyPages(source, [1]);
out.addPage(page);
await writeFile('public/character-sheet.pdf', await out.save());
const { width, height } = page.getSize();
console.log(`Wrote public/character-sheet.pdf (${width}x${height} pt)`);
