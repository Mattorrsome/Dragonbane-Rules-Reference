import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { EquipmentItemDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { DiceRoller } from '../../dice/dice-roller';
import { TREASURE } from '../../treasure/treasure.fixture';
import { TreasurePage } from './treasure.page';

const battleaxe: EquipmentItemDto = {
  id: 19, categoryId: 1, name: 'Battleaxe', costCopper: 1000, costUnit: null, costOrMore: false, costText: '10 gold', supply: 'Uncommon',
  weight: null, effect: null, armour: null,
  weapon: { grip: '1H', strRequirement: 13, range: '2', damage: '2D8', durability: 9, isRanged: false, featuresText: 'Toppling, slashing' },
};

describe('TreasurePage', () => {
  let http: HttpTestingController;
  let faces: number[];

  beforeEach(() => {
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
    http.expectOne('/api/equipment').flush([battleaxe]);
    http.expectOne('/api/currency-rates').flush([
      { name: 'Copper', copperValue: 1 }, { name: 'Silver', copperValue: 10 }, { name: 'Gold', copperValue: 100 },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const roll = async (name: string, rollNumber: number, ...queued: number[]) => {
      faces.push(...queued);
      host.querySelector<HTMLButtonElement>(`button[aria-label="Roll ${name} (${rollNumber})"]`)!.click();
      await fixture.whenStable();
    };
    const live = () => host.querySelector('[aria-live="polite"].treasure-results')!;
    return { host, roll, live, settle: () => fixture.whenStable() };
  }

  it('roll button resolves row 10', async () => {
    const page = await render();
    await page.roll('Silver coins', 10, 3, 4);

    expect(page.live().textContent).toContain('2D6 → 3 + 4 = 7 × 10 = 70 silver');
    expect(page.live().textContent).toContain('Silver coins effect');
  });

  it('gold standard adds conversion', async () => {
    TestBed.inject(CoinStandardStore).set('gold');
    const page = await render();
    await page.roll('Silver coins', 10, 3, 4);

    expect(page.live().textContent).toContain('70 silver (7 gold)');
  });

  it('written standard shows coins as rolled', async () => {
    TestBed.inject(CoinStandardStore).set('written');
    const page = await render();
    await page.roll('Silver coins', 10, 3, 4);

    expect(page.live().textContent).toContain('70 silver');
    expect(page.live().textContent).not.toContain('(7 gold)');
  });

  it('mastercrafted result links and prices', async () => {
    const page = await render();
    await page.roll('Mastercrafted weapon', 31, 3);

    const link = page.live().querySelector('a')!;
    expect(link.textContent?.trim()).toBe('Mastercrafted Battleaxe');
    expect(link.getAttribute('href')).toContain('/equipment');
    expect(page.live().textContent).toContain('100 gold');
  });

  it('grimoire links filtered spells', async () => {
    const page = await render();
    await page.roll('Grimoire', 35, 1, 1, 3);

    const link = [...page.live().querySelectorAll('a')].find(a => a.textContent?.includes('Show matching spells'))!;
    expect(link.getAttribute('href')).toContain('kind=Trick');
    expect(link.getAttribute('href')).toContain('schoolId=2');
  });

  it('live region holds only latest result', async () => {
    const page = await render();
    await page.roll('Silver coins', 10, 3, 4);
    await page.roll('Gemstone', 26, 5);

    expect(page.live().querySelectorAll('app-treasure-result').length).toBe(1);
    expect(page.live().textContent).toContain('ruby');
    expect(page.live().textContent).not.toContain('Silver coins effect');
  });

  it('announces the result count like the other sections', async () => {
    const page = await render();

    expect(page.host.querySelector('p.status')?.getAttribute('aria-live')).toBe('polite');
  });

  it('rolls D40 for the whole table', async () => {
    const page = await render();
    faces.push(26, 5);
    page.host.querySelector<HTMLButtonElement>('button.roll-treasure')!.click();
    await page.settle();

    expect(page.live().textContent).toContain('D40 → 26: Gemstone');
  });
});
