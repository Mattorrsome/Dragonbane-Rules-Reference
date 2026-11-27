import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PDFDocument } from 'pdf-lib';
import { SHEET_ASSETS, SheetAssets } from '../../character/pdf/sheet-assets';
import { CharacterExportMenu } from './character-export-menu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { creationRef as ref } from '../../character/character.fixture';
import { RANDOM } from '../../dice/dice-roller';
import { seededRandom } from '../../dice/seeded-random';
import { SavedCharacter } from '../../character/character';
import { CharacterStore } from '../../character/character.store';
import { CharactersPage } from './characters.page';

/** A two-page blank sheet (colour, printer-friendly) and the real handwriting font, in place of the fetched assets. */
async function sheetAssets(): Promise<SheetAssets> {
  const fs = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): { readFileSync(path: string): Uint8Array } } }).process.getBuiltinModule('node:fs');
  // Copied into this realm's ArrayBuffer: pdf-lib checks `instanceof ArrayBuffer`.
  const buffer = (from: ArrayLike<number>) => { const out = new ArrayBuffer(from.length); new Uint8Array(out).set(from); return out; };
  const sheet = await PDFDocument.create();
  sheet.addPage([600, 800]);
  sheet.addPage([600, 800]);
  return { sheet: buffer(await sheet.save()), font: buffer(fs.readFileSync('public/fonts/Caveat-Regular.ttf')), heading: new ArrayBuffer(0), parchment: new ArrayBuffer(0) };
}

describe('CharactersPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CharactersPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: RANDOM, useValue: seededRandom(7) }, { provide: SHEET_ASSETS, useValue: sheetAssets }],
    });
    http = TestBed.inject(HttpTestingController);
    // jsdom has no modal dialog; close fires the close event, as the browser does.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); };
  });

  afterEach(() => http.verify());

  /** The page as it lands: the My characters list. */
  async function render() {
    const fixture = TestBed.createComponent(CharactersPage);
    TestBed.tick();
    const rows: Record<string, object> = {
      skills: ref.skills, 'heroic-abilities': ref.abilities, equipment: ref.equipment, 'equipment-categories': ref.categories, spells: ref.spells, kin: ref.kin,
      professions: ref.professions, ages: ref.ages, 'magic-schools': ref.schools, mementos: ref.mementos,
      weaknesses: ref.weaknesses, appearances: ref.appearances,
    };
    for (const [section, body] of Object.entries(rows)) http.expectOne(`/api/${section}`).flush(body);
    // A summary or export card, once shown, asks for the coin rates (whenStable would wait on that request).
    const settle = async () => {
      await new Promise(resolve => setTimeout(resolve));
      TestBed.tick();
      for (const request of http.match('/api/currency-rates')) {
        request.flush([{ name: 'Copper', copperValue: 1 }, { name: 'Silver', copperValue: 10 }, { name: 'Gold', copperValue: 100 }]);
      }
      await fixture.whenStable();
    };
    await settle();
    const host = fixture.nativeElement as HTMLElement;
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!;
    const select = (id: string) => host.querySelector<HTMLSelectElement>(`#${id}`)!;
    const choose = async (id: string, value: string) => {
      select(id).value = value;
      select(id).dispatchEvent(new Event('change'));
      await settle();
    };
    const click = async (name: string) => {
      button(name).click();
      await settle();
    };
    const summary = () => host.querySelector('app-character-summary')!.textContent!;
    const options = (scope: Element) => [...scope.querySelectorAll<HTMLElement>('[role="option"]')];
    /** Picks, in the dialog inside `scope`, the option whose text starts with `label`; returns the dialog's message. */
    const pick = async (scope: Element, label: string) => {
      options(scope).find(o => o.textContent!.trim().startsWith(label))!.click();
      await settle();
      return scope.querySelector('.picker-dialog [role="alert"]')?.textContent?.trim() ?? null;
    };
    return { fixture, host, button, select, choose, click, summary, options, pick };
  }

  /** The page with the creator open. */
  async function create() {
    const page = await render();
    await page.click('Create character');
    return page;
  }

  it('lands on My characters, with no creator, and Create character opens the creator in place of the list', async () => {
    const page = await render();

    expect(page.host.querySelector('.creation-steps')).toBeNull();
    expect(page.button('Create character').classList).toContain('btn-primary');
    expect(page.host.querySelector('#my-characters-heading')).not.toBeNull();

    await page.click('Create character');

    expect(page.host.querySelector('.creation-steps')).not.toBeNull();
    expect(page.host.querySelector('#my-characters-heading')).toBeNull();
    expect(page.host.querySelector('.characters-table, .npc-file-actions')).toBeNull();
    const heading = page.host.querySelector<HTMLElement>('h2#create-heading')!;
    expect(heading.textContent?.trim()).toBe('New character');
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
  });

  it('Back to list discards the creation and returns focus to the My characters heading', async () => {
    const page = await create();
    await page.click('Random character');

    await page.click('Back to list');

    expect(page.host.querySelector('.creation-steps')).toBeNull();
    expect(document.activeElement).toBe(page.host.querySelector('#my-characters-heading'));
    await page.click('Create character');
    expect(page.host.querySelector<HTMLInputElement>('#cc-name')!.value).toBe('');
    expect(page.host.querySelector('app-character-summary .npc-card-name')!.textContent!.trim()).toBe('Unnamed hero');
  });

  it('Export works before saving: a fresh, empty creation opens the dialog and makes text, Markdown and the PDF', async () => {
    const page = await create();

    await page.click('Export');

    const dialog = page.host.querySelector<HTMLDialogElement>('dialog.export-dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Export Unnamed hero');
    const menu = page.fixture.debugElement.query(By.directive(CharacterExportMenu)).componentInstance as unknown as {
      toText(): string; toMarkdown(): string; pdf(): Promise<Blob>;
    };
    expect(menu.toText()).toContain('Attributes:');
    expect(menu.toMarkdown()).toContain('Attributes');
    expect((await menu.pdf()).size).toBeGreaterThan(0);

    await page.click('Close');
    expect(dialog.querySelector('app-character-export-menu')).toBeNull();
    expect(page.host.querySelector('.creation-steps')).not.toBeNull();
  });

  it('the spell dialog adds starting spells and says when the spells are full', async () => {
    const page = await create();
    await page.choose('cc-profession', 'Mage');
    await page.choose('cc-school', 'Animism');
    const spells = [...page.host.querySelectorAll('fieldset')].find(f => f.querySelector('legend')?.textContent?.startsWith('Spells'))!;

    for (const name of ['Animal whisperer', 'Banish', 'Cure']) expect(await page.pick(spells, name)).toBeNull();
    expect(spells.querySelector('.chips')!.textContent).toContain('Cure (Animism)');
    expect(await page.pick(spells, 'Cure')).toBe('Already known.');
    expect(await page.pick(spells, 'Ensnaring roots')).toBe('No room: 3 spells and 3 tricks at most.');
    expect(spells.querySelector('.chips')!.textContent).not.toContain('Ensnaring');
  });

  it('the heroic ability dialog sets the ability and names it on its button', async () => {
    const page = await create();
    await page.choose('cc-profession', 'Artisan');
    expect(page.button('Choose heroic ability…')).toBeTruthy();
    expect(page.host.querySelector('#cc-ability')).toBeNull();
    const step = page.host.querySelectorAll('.creation-step')[6];
    expect(page.options(step).map(o => o.textContent!.trim())).toEqual(['Master Blacksmith', 'Master Carpenter', 'Master Tanner']);

    expect(await page.pick(step, 'Master Carpenter')).toBeNull();

    expect(page.summary()).toContain('Master Carpenter');
    expect(page.button('Master Carpenter (change)')).toBeTruthy();
  });

  it('titles the page Dragonbane Character Creator, with a section and a roll button per step in book order', async () => {
    const page = await create();

    expect(page.host.querySelector('h1')?.textContent?.trim()).toBe('Dragonbane Character Creator');
    expect([...page.host.querySelectorAll('details summary .step-label')].map(s => s.textContent?.trim())).toEqual([
      'Kin', 'Profession', 'Age', 'Name', 'Attributes', 'Skills', 'Heroic ability or magic', 'Weakness', 'Memento', 'Gear', 'Appearance',
    ]);
    expect(page.button('Roll Heroic ability or magic')).toBeTruthy();
    const step = page.button('Roll Heroic ability or magic');
    expect(step.classList).toContain('btn-dice');
    expect(step.textContent).not.toContain('🎲');
  });

  it('Random character fills the summary: a name, a kin and HP above 0', async () => {
    const page = await create();

    await page.click('Random character');

    const name = page.host.querySelector('app-character-summary .npc-card-name')!.textContent!.trim();
    expect(ref.kin.flatMap(k => k.names).some(n => name.startsWith(n))).toBe(true);
    expect(ref.kin.some(k => page.summary().includes(`Kin: ${k.name}`))).toBe(true);
    expect(Number(/HP (\d+)/.exec(page.summary())![1])).toBeGreaterThan(0);
    expect(page.host.querySelectorAll('.step-done').length).toBe(11);
  });

  it('the profession roll changes only the profession section and announces the cleared picks', async () => {
    const page = await create();
    await page.choose('cc-kin', 'Human');
    await page.choose('cc-age', 'Adult');
    await page.choose('cc-profession', 'Fighter');
    page.host.querySelector<HTMLInputElement>('#cc-skill-crossbows')!.click();
    await page.click('Roll Profession');

    const profession = page.select('cc-profession').value;
    expect(profession).not.toBe('Fighter');
    expect(page.select('cc-kin').value).toBe('Human');
    expect(page.select('cc-age').value).toBe('Adult');
    const status = page.host.querySelector('[role="status"].creation-cleared')!;
    expect(status.textContent).toContain(`Removed Crossbows: not on the ${profession} skill list.`);
  });

  it('a choice inside the gear package swaps that item and keeps the money', async () => {
    const page = await create();
    await page.choose('cc-profession', 'Fighter');
    await page.choose('cc-gear', '1');
    const money = /Money: ([^\n]*?)(?=Weakness|$)/.exec(page.summary())![1];

    await page.choose('cc-option-1', '1');

    expect(page.summary()).toContain('Morningstar');
    expect(page.summary()).not.toContain('Battleaxe');
    expect(/Money: ([^\n]*?)(?=Weakness|$)/.exec(page.summary())![1]).toBe(money);
  });

  it('Save is disabled on a fresh page and lists what is missing', async () => {
    const page = await create();

    expect(page.button('Save').disabled).toBe(true);
    const problems = [...page.host.querySelectorAll('.creation-problems li')].map(li => li.textContent?.trim());
    expect(problems).toContain('Choose a kin.');
    expect(problems).toContain('Roll or enter the attributes.');
  });

  it('attributes: six typed scores set them, kept within 3-18, and one swap is allowed', async () => {
    const page = await create();
    const scores = { STR: 25, CON: 12, AGL: 9, INT: 14, WIL: 11, CHA: 2 };
    for (const [a, v] of Object.entries(scores)) {
      const box = page.host.querySelector<HTMLInputElement>(`#cc-attr-${a}`)!;
      box.value = String(v);
      box.dispatchEvent(new Event('change'));
    }
    await page.choose('cc-swap-a', 'STR');
    await page.choose('cc-swap-b', 'CHA');
    await page.click('Swap');

    expect(page.summary()).toMatch(/STR 3(?!\d)/);
    expect(page.summary()).toMatch(/CHA 18(?!\d)/);
    expect(page.button('Swap').disabled).toBe(true);
  });

  it('the summary shows dashes, not placeholder scores, until the attributes are set', async () => {
    const page = await create();

    expect(page.summary()).toContain('STR – CON –');
    expect(page.summary()).toContain('HP –');
    expect(page.summary()).not.toContain('HP 10');
    await page.click('Random character');
    expect(page.summary()).not.toContain('–');
  });

  it('skill checkbox ids have no spaces', async () => {
    const page = await create();
    await page.choose('cc-profession', 'Fighter');

    const ids = [...page.host.querySelectorAll<HTMLInputElement>('.skill-checks input')].map(i => i.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(id => !/\s/.test(id))).toBe(true);
  });

  describe('My characters', () => {
    beforeEach(() => localStorage.clear());

    it('says so when nothing is saved', async () => {
      const page = await render();

      expect(page.host.textContent).toContain('No saved characters yet.');
    });

    it('Save stores the finished character, returns to the list with its row and announces it', async () => {
      const page = await create();
      await page.click('Random character');
      const name = page.host.querySelector('app-character-summary .npc-card-name')!.textContent!.trim();

      await page.click('Save');

      const store = TestBed.inject(CharacterStore);
      expect(store.characters().map(c => [c.name, c.nickname].filter(Boolean).join(' '))).toEqual([name]);
      expect(page.host.querySelector('.creation-steps')).toBeNull();
      expect(page.host.querySelector('.characters-table tbody')!.textContent).toContain(store.characters()[0].name);
      const statuses = [...page.host.querySelectorAll('.save-status')];
      expect(statuses.length).toBe(1);
      expect(statuses[0].textContent?.trim()).toBe(`Saved ${store.characters()[0].name}.`);
      // A fresh creation: nothing carried over, and the first change clears the status.
      await page.click('Create character');
      expect(page.host.querySelector('app-character-summary .npc-card-name')!.textContent!.trim()).toBe('Unnamed hero');
      expect(page.button('Save').disabled).toBe(true);
      await page.click('Random character');
      expect(page.host.querySelector('.save-status')!.textContent!.trim()).toBe('');
    });

    it('Save keeps keyboard focus on the page: it moves to the My characters heading', async () => {
      const page = await create();
      await page.click('Random character');
      page.button('Save').focus();

      await page.click('Save');

      expect(document.activeElement).toBe(page.host.querySelector('#my-characters-heading'));
    });

    it('Delete asks in the page and removes only that character', async () => {
      const page = await render();
      const store = TestBed.inject(CharacterStore);
      for (let i = 0; i < 2; i++) {
        await page.click('Create character');
        await page.click('Random character');
        await page.click('Save');
      }
      const [first, second] = store.characters();

      await page.click(`Delete ${first.name}`);
      expect(page.host.textContent).toContain(`Delete ${first.name}?`);
      await page.click('Keep');
      expect(store.characters().length).toBe(2);

      await page.click(`Delete ${first.name}`);
      await page.click('Yes, delete');

      expect(store.characters().map(c => c.id)).toEqual([second.id]);
    });

    it('Import JSON reports a bad file and imports nothing', async () => {
      const page = await render();
      const input = page.host.querySelector<HTMLInputElement>('input[type="file"]')!;
      const file = new File(['[{"id":"a","name":"Bryn","skills":[{"name":"Axes","level":19}]}]'], 'c.json');
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change'));
      await new Promise(resolve => setTimeout(resolve));
      await TestBed.inject(ApplicationRef).whenStable();

      expect(page.host.querySelector('.import-status')!.textContent).toContain('Nothing was imported.');
      expect(TestBed.inject(CharacterStore).characters()).toEqual([]);
    });
  });

  describe('Edit', () => {
    const aodhan: SavedCharacter = {
      id: 'aodhan-1', name: 'Aodhan', nickname: '', kin: 'Human', profession: 'Mage', school: 'Animism', age: 'Adult',
      attributes: { STR: 10, CON: 11, AGL: 9, INT: 10, WIL: 18, CHA: 10 },
      skills: [{ name: 'Animism', level: 12, trained: true }], abilities: [], kinAbilities: ['Adaptive'], spells: [], gear: [],
      copper: 0, weakness: '', memento: '', appearance: '',
    };

    beforeEach(() => {
      localStorage.clear();
      TestBed.inject(CharacterStore).save(aodhan);
    });

    async function edit() {
      const page = await render();
      await page.click('Edit Aodhan');
      const editor = page.host.querySelector('app-character-editor')!;
      const box = (id: string) => editor.querySelector<HTMLInputElement>(`#${id}`)!;
      const fieldset = (legend: string) =>
        [...editor.querySelectorAll('fieldset')].find(f => f.querySelector('legend')?.textContent?.trim() === legend)!;
      const options = (legend: string) => [...fieldset(legend).querySelectorAll<HTMLElement>('[role="option"]')];
      /** Opens the fieldset's add dialog and picks the option whose text starts with `label`. */
      const pick = async (legend: string, label: string) => {
        options(legend).find(o => o.textContent!.trim().startsWith(label))!.click();
        await TestBed.inject(ApplicationRef).whenStable();
      };
      const type = async (id: string, value: string, event = 'input') => {
        box(id).value = value;
        box(id).dispatchEvent(new Event(event));
        await TestBed.inject(ApplicationRef).whenStable();
      };
      return { ...page, editor, box, type, fieldset, options, pick };
    }

    it('Export opens the export menu for that character in a dialog, and Close empties it', async () => {
      const page = await render();
      await page.click('Export Aodhan');

      const dialog = page.host.querySelector('dialog.export-dialog')!;
      expect(dialog.querySelector('h2')?.textContent).toContain('Export Aodhan');
      expect(dialog.querySelector('app-character-card .npc-card-name')?.textContent).toBe('Aodhan');

      await page.click('Close');
      expect(dialog.querySelector('app-character-export-menu')).toBeNull();
    });

    it('shows kin, profession, age and school as text, with no rolls and no Random', async () => {
      const page = await edit();

      const locked = page.editor.querySelector('.character-locked')!;
      expect(locked.textContent).toContain('Kin: Human');
      expect(locked.textContent).toContain('Mage (Animism)');
      expect(locked.querySelector('input, select')).toBeNull();
      expect(page.host.querySelector('#cc-kin')).toBeNull();
      expect(page.host.querySelector('.step-roll')).toBeNull();
      expect(page.button('Random character')).toBeUndefined();
    });

    it('Robust 2 shows HP 15 in the summary', async () => {
      const page = await edit();

      await page.pick('Heroic abilities', 'Robust');
      await page.type('ce-count-robust', '2');

      expect(page.summary()).toContain('HP 15');
    });

    it('raising CON raises HP', async () => {
      const page = await edit();

      await page.type('ce-attr-CON', '13');

      expect(page.summary()).toContain('HP 13');
    });

    it('a skill can be set to 18 but not 19', async () => {
      const page = await edit();

      await page.type('ce-skill-awareness', '18');
      expect(page.box('ce-skill-awareness').value).toBe('18');
      await page.type('ce-skill-awareness', '19');
      expect(page.box('ce-skill-awareness').value).toBe('18');
    });

    it('raising an untrained skill shows it in the preview', async () => {
      const page = await edit();

      await page.type('ce-skill-awareness', '15');

      expect(page.summary()).toContain('Awareness 15');
    });

    it('Save keeps the id and replaces the saved character; money is stored as copper', async () => {
      const page = await edit();
      const store = TestBed.inject(CharacterStore);

      await page.type('ce-name', 'Aodhan the Bold');
      await page.type('ce-silver', '3', 'change');
      await page.type('ce-copper', '4', 'change');
      await page.click('Save');

      expect(store.characters().length).toBe(1);
      expect(store.characters()[0]).toMatchObject({ id: 'aodhan-1', name: 'Aodhan the Bold', copper: 34 });
      expect(page.host.querySelector('app-character-editor')).toBeNull();
    });

    it('Cancel discards the changes', async () => {
      const page = await edit();

      await page.type('ce-name', 'Bryn');
      await page.click('Cancel');

      expect(TestBed.inject(CharacterStore).characters()).toEqual([aodhan]);
      expect(page.host.querySelector('app-character-editor')).toBeNull();
      expect(page.host.querySelector('.characters-table')).not.toBeNull();
      expect(document.activeElement).toBe(page.host.querySelector('#my-characters-heading'));
    });

    it('Edit shows the editor in place of the list, with no creator', async () => {
      const page = await edit();

      expect(page.editor).not.toBeNull();
      expect(page.host.querySelector('.characters-table, #my-characters-heading, .creation-steps')).toBeNull();
      expect(page.button('Create character')).toBeUndefined();
    });

    it('announces an edit save in a status region that stays on the page', async () => {
      const page = await render();
      const status = page.host.querySelector('.save-status')!;
      await page.click('Edit Aodhan');
      expect(page.host.querySelector('.save-status')).toBe(status);

      await page.click('Save');

      expect(page.host.querySelector('.save-status')).toBe(status);
      expect(status.getAttribute('role')).toBe('status');
      expect(status.textContent).toContain('Saved Aodhan.');
    });

    it('shows a heroic ability prerequisite as text in its chip', async () => {
      const page = await edit();

      await page.pick('Heroic abilities', 'Veteran');

      expect(page.editor.querySelector('.chips[aria-label="Heroic abilities"]')!.textContent).toContain('Prerequisite: Any weapon skill 12');
    });

    it('with no school skill, the Spells fieldset explains and has no Add spell button', async () => {
      TestBed.inject(CharacterStore).save({ ...aodhan, skills: [] });
      const page = await edit();

      expect(page.fieldset('Spells').textContent).toContain('Learning spells needs a magic school skill at level 1 or more.');
      expect(page.button('Add spell…')).toBeUndefined();
    });

    it('with Animism 1, the spell dialog lists Animism and General Magic but not Elementalism', async () => {
      const page = await edit();
      await page.type('ce-skill-animism', '1');

      const groups = [...page.fieldset('Spells').querySelectorAll('.picker-group-heading')].map(h => h.textContent!.trim());
      expect(groups).toEqual(['Animism', 'General Magic']);
    });

    it('a known spell from another school stays a chip, can be removed, and shows as added only when listed', async () => {
      TestBed.inject(CharacterStore).save({ ...aodhan, spells: [{ name: 'FIREBALL', school: 'Elementalism', kind: 'Spell' }] });
      const page = await edit();
      const chips = () => page.fieldset('Spells').querySelector('.chips')!.textContent;

      expect(chips()).toContain('Fireball');
      expect(page.options('Spells').some(o => o.textContent!.includes('added'))).toBe(false);

      await page.pick('Spells', 'Cure');
      expect(page.options('Spells').find(o => o.textContent!.includes('Cure'))!.textContent).toContain('added');

      await page.click('Remove Fireball (Elementalism)');
      expect(chips()).not.toContain('Fireball');
    });

    it('picking a gear item adds the chip, and picking it again raises its quantity', async () => {
      // The shared fixture carries no equipment; add a Torch for this test only.
      ref.categories.push({ id: 1, name: 'General gear' } as (typeof ref.categories)[number]);
      ref.equipment.push({
        id: 1, categoryId: 1, name: 'Torch', costCopper: 1, costUnit: null, costOrMore: false, costText: '1 copper', supply: 'Common',
        weight: null, effect: null, weapon: null, armour: null,
      } as (typeof ref.equipment)[number]);
      try {
        const page = await edit();

        await page.pick('Gear', 'Torch');
        await page.pick('Gear', 'Torch');

        const qty = page.fieldset('Gear').querySelector<HTMLInputElement>('input[aria-label="Torch quantity"]')!;
        expect(qty.value).toBe('2');
      } finally {
        ref.categories.pop();
        ref.equipment.pop();
      }
    });
  });
});
