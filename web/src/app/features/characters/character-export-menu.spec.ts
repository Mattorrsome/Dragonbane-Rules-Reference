import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PDFDocument } from 'pdf-lib';
import { Character } from '../../character/character';
import { SHEET_ASSETS, SheetAssets } from '../../character/pdf/sheet-assets';
import { creationRef } from '../../character/character.fixture';
import { CharacterExportMenu } from './character-export-menu';

const hero: Character = {
  name: 'Aodhan', nickname: '', kin: 'Human', profession: 'Mage', school: null, age: 'Adult',
  attributes: { STR: 10, CON: 10, AGL: 10, INT: 10, WIL: 10, CHA: 10 },
  skills: [], abilities: [], kinAbilities: [], spells: [], gear: [], copper: 0, weakness: '', memento: '', appearance: '',
};

describe('CharacterExportMenu', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [CharacterExportMenu], providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('shows the export card and remembers the descriptions checkbox', () => {
    const fixture = TestBed.createComponent(CharacterExportMenu);
    fixture.componentRef.setInput('character', hero);
    fixture.componentRef.setInput('ref', creationRef);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.export-card .npc-card-name')?.textContent).toBe('Aodhan');
    host.querySelector<HTMLInputElement>('#export-descriptions')!.click();
    expect(localStorage.getItem('dragonbane.characterExport.descriptions')).toBe('true');
  });

  it('offers the sheet PDF under Download', () => {
    const fixture = TestBed.createComponent(CharacterExportMenu);
    fixture.componentRef.setInput('character', hero);
    fixture.componentRef.setInput('ref', creationRef);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Download')!.click();
    fixture.detectChanges();
    expect(host.querySelector('button[aria-label="Download PDF"]')).not.toBeNull();
  });

  it('makes the PDF from the sheet page 2 once printer-friendly is ticked, and remembers it', async () => {
    const fs = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): { readFileSync(path: string): Uint8Array } } }).process.getBuiltinModule('node:fs');
    // Copied into this realm's ArrayBuffer: pdf-lib checks `instanceof ArrayBuffer`.
    const buffer = (from: ArrayLike<number>) => { const out = new ArrayBuffer(from.length); new Uint8Array(out).set(from); return out; };
    const sheet = await PDFDocument.create();
    sheet.addPage([600, 800]);
    sheet.addPage([500, 700]);
    const assets: SheetAssets = {
      sheet: buffer(await sheet.save()), font: buffer(fs.readFileSync('public/fonts/Caveat-Regular.ttf')), heading: new ArrayBuffer(0), parchment: new ArrayBuffer(0),
    };
    TestBed.overrideProvider(SHEET_ASSETS, { useValue: async () => assets });
    const fixture = TestBed.createComponent(CharacterExportMenu);
    fixture.componentRef.setInput('character', hero);
    fixture.componentRef.setInput('ref', creationRef);
    fixture.detectChanges();
    const make = () => (fixture.componentInstance as unknown as { pdf(): Promise<Blob> }).pdf();
    const size = async () => (await PDFDocument.load(await (await make()).arrayBuffer())).getPage(0).getSize();

    expect(await size()).toEqual({ width: 600, height: 800 });
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#export-printer')!.click();
    expect(localStorage.getItem('dragonbane.characterExport.printerFriendly')).toBe('true');
    expect(await size()).toEqual({ width: 500, height: 700 });
  });
});
