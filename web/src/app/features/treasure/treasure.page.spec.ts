import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { EquipmentCategoryDto, EquipmentItemDto, SpellDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { DiceRoller } from '../../dice/dice-roller';
import { TREASURE } from '../../treasure/treasure.fixture';
import { TreasurePage } from './treasure.page';

const battleaxe: EquipmentItemDto = {
  id: 19, categoryId: 1, name: 'Battleaxe', costCopper: 1000, costUnit: null, costOrMore: false, costText: '10 gold', supply: 'Uncommon',
  weight: null, effect: null, armour: null,
  weapon: { grip: '1H', strRequirement: 13, range: '2', damage: '2D8', durability: 9, isRanged: false, featuresText: 'Toppling, slashing' },
};
const potion: EquipmentItemDto = {
  id: 114, categoryId: 9, name: 'Healing potion, dose', costCopper: 1000, costUnit: null, costOrMore: false, costText: '10 gold', supply: 'Rare',
  weight: null, effect: 'Heals HP.', armour: null, weapon: null,
};
const categories: EquipmentCategoryDto[] = [
  { id: 1, name: 'Melee weapons', nameHeader: 'Weapon', effectHeader: null, hasWeight: false, canResell: true, note: null },
  { id: 9, name: 'Medicine', nameHeader: 'Item', effectHeader: 'Effect', hasWeight: false, canResell: true, note: null },
];
const trick = (id: number, name: string): SpellDto => ({
  id, name, schoolId: 2, school: 'Animism', rank: 0, kind: 'Trick', castingTime: 'Action',
  requirementText: 'Gesture', description: '', ranked: null, recipe: null,
});

describe('TreasurePage', () => {
  let http: HttpTestingController;
  let faces: number[];

  beforeEach(() => {
    // jsdom has no modal dialog; the browser behaviour is covered by the e2e test.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
    localStorage.clear();
    faces = [];
    TestBed.configureTestingModule({
      imports: [TreasurePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        // Returns queued faces in order, ignoring the die size.
        { provide: DiceRoller, useValue: { roll: (count: number) => faces.splice(0, count) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render() {
    const fixture = TestBed.createComponent(TreasurePage);
    TestBed.tick();
    http.expectOne('/api/treasure').flush(TREASURE);
    http.expectOne('/api/equipment').flush([battleaxe, potion]);
    http.expectOne('/api/equipment-categories').flush(categories);
    http.expectOne('/api/spells').flush([trick(1, 'FETCH'), trick(2, 'LIGHT')]);
    http.expectOne('/api/currency-rates').flush([
      { name: 'Copper', copperValue: 1 }, { name: 'Silver', copperValue: 10 }, { name: 'Gold', copperValue: 100 },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = () => fixture.whenStable();
    const roll = async (name: string, rollNumber: number, ...queued: number[]) => {
      faces.push(...queued);
      host.querySelector<HTMLButtonElement>(`button[aria-label="Roll ${name} (${rollNumber})"]`)!.click();
      await settle();
    };
    const dialog = () => host.querySelector('dialog')!;
    const button = (text: string) => [...dialog().querySelectorAll('button')].find(b => b.textContent?.trim() === text)!;
    return { host, roll, dialog, button, settle };
  }

  it('row roll opens a titled dialog with outcomes only', async () => {
    const page = await render();
    await page.roll('Silver coins', 10, 3, 4);

    expect(page.dialog().open).toBe(true);
    expect(page.dialog().querySelector('h2')?.textContent?.trim()).toBe('10 - Silver coins');
    expect(page.dialog().getAttribute('aria-labelledby')).toBe(page.dialog().querySelector('h2')?.id);
    expect(page.dialog().textContent).toContain('Silver coins effect');
    expect(page.dialog().textContent).toContain('70 silver');
    expect(page.dialog().textContent).not.toContain('→');
  });

  it('gold standard adds conversion', async () => {
    TestBed.inject(CoinStandardStore).set('gold');
    const page = await render();
    await page.roll('Silver coins', 10, 3, 4);

    expect(page.dialog().textContent).toContain('70 silver (7 gold)');
  });

  it('written standard shows coins as rolled', async () => {
    const page = await render();
    await page.roll('Silver coins', 10, 3, 4);

    expect(page.dialog().textContent).not.toContain('(7 gold)');
  });

  it('rat shows the effect then the damage', async () => {
    const page = await render();
    await page.roll('Rat', 40, 4);

    const text = page.dialog().textContent!;
    expect(text.indexOf('Rat effect')).toBeLessThan(text.indexOf('4 damage'));
  });

  it('gem shows its name and value', async () => {
    const page = await render();
    await page.roll('Gemstone', 26, 4);

    expect(page.dialog().textContent).toContain('Sapphire — 15 gold');
  });

  it('mastercrafted battleaxe links and shows mastercrafted stats', async () => {
    TestBed.inject(CoinStandardStore).set('gold');
    const page = await render();
    await page.roll('Mastercrafted weapon', 31, 3);

    const link = page.dialog().querySelector('a')!;
    expect(link.textContent?.trim()).toBe('Mastercrafted Battleaxe');
    expect(link.getAttribute('href')).toContain('/equipment');
    const stats = Object.fromEntries([...page.dialog().querySelectorAll('.item-stats div')]
      .map(d => [d.querySelector('dt')!.textContent!.trim(), d.querySelector('dd')!.textContent!.trim()]));
    expect(stats).toEqual({ Grip: '1H', STR: '10', Range: '2', Damage: '2D8', Durability: '12', Cost: '100 gold', Features: 'Toppling, slashing' });
  });

  it('healing potion shows its dice without rolling HP', async () => {
    const page = await render();
    await page.roll('Bottle', 36, 6, 9, 9, 9);

    expect(page.dialog().textContent).toContain('(healing potion 3D6 HP)');
    expect(page.dialog().querySelector('.item-stats')?.textContent).toContain('Heals HP.');
    expect(faces).toEqual([9, 9, 9]);
  });

  it('grimoire suggests spells and links the matching spells', async () => {
    const page = await render();
    // school Animism, rank 0 (tricks), 3 spells; only 2 tricks exist, picked first each time.
    await page.roll('Grimoire', 35, 1, 1, 3, 1, 1);

    expect(page.dialog().textContent).toContain('School: Animism');
    expect(page.dialog().textContent).toContain('Tricks');
    expect(page.dialog().textContent).toContain('3 spells');
    expect([...page.dialog().querySelectorAll('.spell-suggestions a')].map(a => a.textContent?.trim())).toEqual(['Fetch', 'Light']);
    const link = [...page.dialog().querySelectorAll('a')].find(a => a.textContent?.includes('Show matching spells'))!;
    expect(link.getAttribute('href')).toContain('kind=Trick');
    expect(link.getAttribute('href')).toContain('schoolId=2');
  });

  it('roll again after a row roll re-rolls the same row', async () => {
    const page = await render();
    await page.roll('Rat', 40, 2);

    faces.push(3);
    page.button('Roll again').click();
    await page.settle();

    expect(faces).toEqual([]);
    expect(page.dialog().querySelector('h2')?.textContent?.trim()).toBe('40 - Rat');
    expect(page.dialog().textContent).toContain('3 damage');
    expect(page.dialog().querySelectorAll('app-treasure-result').length).toBe(1);
  });

  it('roll again after a table roll rolls the D40 again', async () => {
    const page = await render();
    faces.push(26, 5);
    page.host.querySelector<HTMLButtonElement>('button.roll-treasure')!.click();
    await page.settle();
    expect(page.dialog().querySelector('h2')?.textContent?.trim()).toBe('26 - Gemstone');

    faces.push(40, 2);
    page.button('Roll again').click();
    await page.settle();

    expect(page.dialog().querySelector('h2')?.textContent?.trim()).toBe('40 - Rat');
  });

  it('close button closes the dialog', async () => {
    const page = await render();
    await page.roll('Rat', 40, 2);

    page.button('Close').click();
    await page.settle();

    expect(page.dialog().open).toBe(false);
  });

  it('announces the result count like the other sections', async () => {
    const page = await render();

    expect(page.host.querySelector('p.status')?.getAttribute('aria-live')).toBe('polite');
  });
});
