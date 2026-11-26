import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { creationRef as ref } from '../../character/character.fixture';
import { RANDOM } from '../../dice/dice-roller';
import { seededRandom } from '../../dice/seeded-random';
import { CharacterStore } from '../../character/character.store';
import { CharactersPage } from './characters.page';

describe('CharactersPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CharactersPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: RANDOM, useValue: seededRandom(7) }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render() {
    const fixture = TestBed.createComponent(CharactersPage);
    TestBed.tick();
    const rows: Record<string, object> = {
      skills: ref.skills, 'heroic-abilities': ref.abilities, equipment: ref.equipment, spells: ref.spells, kin: ref.kin,
      professions: ref.professions, ages: ref.ages, 'magic-schools': ref.schools, mementos: ref.mementos,
      weaknesses: ref.weaknesses, appearances: ref.appearances,
    };
    for (const [section, body] of Object.entries(rows)) http.expectOne(`/api/${section}`).flush(body);
    // The summary, shown once the tables are in, asks for the coin rates (whenStable would wait on that request).
    await new Promise(resolve => setTimeout(resolve));
    TestBed.tick();
    http.expectOne('/api/currency-rates').flush([
      { name: 'Copper', copperValue: 1 }, { name: 'Silver', copperValue: 10 }, { name: 'Gold', copperValue: 100 },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!;
    const select = (id: string) => host.querySelector<HTMLSelectElement>(`#${id}`)!;
    const choose = async (id: string, value: string) => {
      select(id).value = value;
      select(id).dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };
    const click = async (name: string) => {
      button(name).click();
      await fixture.whenStable();
    };
    const summary = () => host.querySelector('app-character-summary')!.textContent!;
    return { host, button, select, choose, click, summary };
  }

  it('titles the page Dragonbane Character Creator, with a section and a roll button per step in book order', async () => {
    const page = await render();

    expect(page.host.querySelector('h1')?.textContent?.trim()).toBe('Dragonbane Character Creator');
    expect([...page.host.querySelectorAll('details summary .step-label')].map(s => s.textContent?.trim())).toEqual([
      'Kin', 'Profession', 'Age', 'Name', 'Attributes', 'Skills', 'Heroic ability or magic', 'Weakness', 'Memento', 'Gear', 'Appearance',
    ]);
    expect(page.button('Roll Heroic ability or magic')).toBeTruthy();
  });

  it('Random character fills the summary: a name, a kin and HP above 0', async () => {
    const page = await render();

    await page.click('Random character');

    const name = page.host.querySelector('app-character-summary .npc-card-name')!.textContent!.trim();
    expect(ref.kin.flatMap(k => k.names)).toContain(name);
    expect(ref.kin.some(k => page.summary().includes(`Kin: ${k.name}`))).toBe(true);
    expect(Number(/HP: (\d+)/.exec(page.summary())![1])).toBeGreaterThan(0);
    expect(page.host.querySelectorAll('.step-done').length).toBe(11);
  });

  it('the profession roll changes only the profession section and announces the cleared picks', async () => {
    const page = await render();
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
    const page = await render();
    await page.choose('cc-profession', 'Fighter');
    await page.choose('cc-gear', '1');
    const money = /Money: ([^\n]*?)(?=Weakness|$)/.exec(page.summary())![1];

    await page.choose('cc-option-1', '1');

    expect(page.summary()).toContain('Morningstar');
    expect(page.summary()).not.toContain('Battleaxe');
    expect(/Money: ([^\n]*?)(?=Weakness|$)/.exec(page.summary())![1]).toBe(money);
  });

  it('Save is disabled on a fresh page and lists what is missing', async () => {
    const page = await render();

    expect(page.button('Save').disabled).toBe(true);
    const problems = [...page.host.querySelectorAll('.creation-problems li')].map(li => li.textContent?.trim());
    expect(problems).toContain('Choose a kin.');
    expect(problems).toContain('Roll or enter the attributes.');
  });

  it('attributes: six typed scores set them, kept within 3-18, and one swap is allowed', async () => {
    const page = await render();
    const scores = { STR: 25, CON: 12, AGL: 9, INT: 14, WIL: 11, CHA: 2 };
    for (const [a, v] of Object.entries(scores)) {
      const box = page.host.querySelector<HTMLInputElement>(`#cc-attr-${a}`)!;
      box.value = String(v);
      box.dispatchEvent(new Event('change'));
    }
    await page.choose('cc-swap-a', 'STR');
    await page.choose('cc-swap-b', 'CHA');
    await page.click('Swap');

    expect(page.summary()).toMatch(/STR: 3(?!\d)/);
    expect(page.summary()).toMatch(/CHA: 18(?!\d)/);
    expect(page.button('Swap').disabled).toBe(true);
  });

  it('the summary shows dashes, not placeholder scores, until the attributes are set', async () => {
    const page = await render();

    expect(page.summary()).toMatch(/STR: –\s*CON: –/);
    expect(page.summary()).toContain('HP: –');
    expect(page.summary()).not.toContain('HP: 10');
    await page.click('Random character');
    expect(page.summary()).not.toContain('–');
  });

  it('skill checkbox ids have no spaces', async () => {
    const page = await render();
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

    it('Save stores the finished character, resets the creator and lists it', async () => {
      const page = await render();
      await page.click('Random character');
      const name = page.host.querySelector('app-character-summary .npc-card-name')!.textContent!.trim();

      await page.click('Save');

      expect(TestBed.inject(CharacterStore).characters().map(c => c.name)).toEqual([name]);
      expect(page.host.querySelector('app-character-summary .npc-card-name')!.textContent!.trim()).toBe('Unnamed hero');
      expect(page.button('Save').disabled).toBe(true);
      expect(page.host.querySelector('.characters-table tbody')!.textContent).toContain(name);
    });

    it('Delete asks in the page and removes only that character', async () => {
      const page = await render();
      const store = TestBed.inject(CharacterStore);
      for (let i = 0; i < 2; i++) {
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
});
