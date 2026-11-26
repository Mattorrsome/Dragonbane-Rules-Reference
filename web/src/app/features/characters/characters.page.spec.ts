import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { creationRef as ref } from '../../character/character.fixture';
import { RANDOM } from '../../dice/dice-roller';
import { seededRandom } from '../../dice/seeded-random';
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
    page.host.querySelector<HTMLInputElement>('#cc-skill-Crossbows')!.click();
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
});
