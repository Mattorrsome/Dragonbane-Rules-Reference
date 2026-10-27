import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { EquipmentCategoryDto, EquipmentItemDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { EquipmentPage } from './equipment.page';

const categories: EquipmentCategoryDto[] = [
  { id: 1, name: 'Melee weapons', nameHeader: 'Weapon', effectHeader: 'Features', hasWeight: false, canResell: true, note: 'A mastercrafted version costs 10 times normal.' },
  { id: 2, name: 'Services', nameHeader: 'Service', effectHeader: 'Effect', hasWeight: false, canResell: false, note: null },
];

const weapon = (id: number, name: string, costCopper: number, costText: string, str: number | null, durability: number | null): EquipmentItemDto => ({
  id, categoryId: 1, name, costCopper, costUnit: null, costOrMore: false, costText, supply: 'Common', weight: null, effect: null,
  weapon: { grip: '1H', strRequirement: str, range: '2', damage: '2D8', durability, isRanged: false, featuresText: 'Toppling, slashing', skill: 'Axes' },
  armour: null,
});

const items: EquipmentItemDto[] = [
  weapon(1, 'Dagger', 100, '1 gold', null, 9),
  weapon(2, 'Battleaxe', 1000, '10 gold', 13, 9),
  {
    id: 3, categoryId: 2, name: 'Inn bath', costCopper: 6, costUnit: null, costOrMore: false, costText: '6 copper', supply: 'Common',
    weight: null, effect: 'Heal one condition.', weapon: null, armour: null,
  },
];

describe('EquipmentPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [EquipmentPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render() {
    const fixture = TestBed.createComponent(EquipmentPage);
    TestBed.tick();
    http.expectOne('/api/equipment-categories').flush(categories);
    http.expectOne(r => r.url === '/api/equipment').flush(items);
    http.expectOne('/api/supplies').flush([{ id: 1, name: 'Common', description: 'Normally available.' }]);
    http.expectOne('/api/weapon-terms').flush([{ id: 1, name: 'Grip', description: 'Hands needed.' }]);
    http.expectOne('/api/weapon-features').flush([{ id: 1, name: 'Subtle', description: 'Sneak attack boon.' }]);
    http.expectOne('/api/currency-rates').flush([
      { name: 'Copper', copperValue: 1 }, { name: 'Silver', copperValue: 10 }, { name: 'Gold', copperValue: 100 },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = () => fixture.whenStable();
    const cost = (name: string) =>
      [...host.querySelectorAll('tbody tr')].find(tr => tr.querySelector('td')?.textContent?.includes(name))
        ?.querySelector('td[data-label="Cost"]')?.textContent?.trim();
    const sell = async (rate: string) => {
      host.querySelector<HTMLInputElement>('input[name="price-mode"][value="sell"]')!.click();
      await settle();
      host.querySelector<HTMLInputElement>(`input[name="sell-rate"][value="${rate}"]`)!.click();
      await settle();
    };
    const row = (name: string) => [...host.querySelectorAll('tbody tr')].find(tr => tr.querySelector('td')?.textContent?.includes(name))!;
    const cell = (name: string, label: string) => row(name).querySelector(`td[data-label="${label}"]`)?.textContent?.trim();
    const toggle = (name: string) => row(name).querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    const global = async (on: boolean) => {
      const toggle = host.querySelector<HTMLButtonElement>('#all-mastercrafted')!;
      if ((toggle.getAttribute('aria-pressed') === 'true') !== on) toggle.click();
      await settle();
    };
    return { host, cost, sell, settle, row, cell, toggle, global };
  }

  it('sell 50% halves price', async () => {
    const page = await render();
    expect(page.cost('Dagger')).toBe('1 gold');

    await page.sell('50');

    expect(page.cost('Dagger')).toBe('5 silver');
  });

  it('services show dash when selling', async () => {
    const page = await render();
    await page.sell('100');

    expect(page.cost('Inn bath')).toBe('—');
  });

  it('written standard shows CostText for base price only', async () => {
    TestBed.inject(CoinStandardStore).set('written');
    const page = await render();
    expect(page.cost('Dagger')).toBe('1 gold');

    await page.sell('50');

    expect(page.cost('Dagger')).toBe('5 silver');
  });

  it('mastercrafted toggles in the row', async () => {
    const page = await render();
    const toggle = page.toggle('Battleaxe');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    await page.settle();

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(page.row('Battleaxe').classList).toContain('mastercrafted');
    expect(page.cell('Battleaxe', 'STR')).toBe('10');
    expect(page.cell('Battleaxe', 'Durability')).toBe('12');
    expect(page.cost('Battleaxe')).toBe('100 gold');
    expect(page.host.querySelector('.sub-row')).toBeNull();
    expect(page.row('Dagger').classList).not.toContain('mastercrafted');
  });

  it('ranged weapons have no mastercrafted button', async () => {
    const bow = weapon(5, 'Longbow', 2500, '25 gold', 12, 6);
    items.push({ ...bow, weapon: { ...bow.weapon!, isRanged: true } });
    const page = await render();
    items.pop();

    expect(page.row('Longbow').querySelector('button')).toBeNull();
  });

  it('global toggle mastercrafts every priced melee row and disables the row buttons', async () => {
    const page = await render();

    await page.global(true);

    expect(page.row('Dagger').classList).toContain('mastercrafted');
    expect(page.row('Battleaxe').classList).toContain('mastercrafted');
    expect(page.cell('Dagger', 'Durability')).toBe('12');
    expect(page.toggle('Dagger').disabled).toBe(true);
    expect(page.toggle('Dagger').getAttribute('aria-pressed')).toBe('true');
  });

  it('"Mastercraft all" is a toggle button in the Melee weapons heading row', async () => {
    const page = await render();

    const toggle = page.host.querySelector<HTMLButtonElement>('#all-mastercrafted')!;
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.textContent?.trim()).toBe('Mastercraft all');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.closest('.section-head')?.querySelector('h2')?.textContent).toBe('Melee weapons');

    await page.global(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('global off restores each row its own state', async () => {
    const page = await render();
    page.toggle('Battleaxe').click();
    await page.settle();

    await page.global(true);
    await page.global(false);

    expect(page.row('Battleaxe').classList).toContain('mastercrafted');
    expect(page.row('Dagger').classList).not.toContain('mastercrafted');
  });

  it('sell rate applies to the mastercrafted cost', async () => {
    const page = await render();
    page.toggle('Battleaxe').click();
    await page.settle();

    await page.sell('50');

    expect(page.cost('Battleaxe')).toBe('50 gold');
  });

  it('sell rate then bartering apply to the mastercrafted cost', async () => {
    const page = await render();
    page.toggle('Battleaxe').click();
    await page.settle();
    await page.sell('50');

    page.host.querySelector<HTMLInputElement>('input[name="barter-result"][value="success"]')!.click();
    await page.settle();

    // 10 gold ×10 mastercrafted → 50% sell rate → +20% for a successful barter when selling.
    expect(page.cost('Battleaxe')).toBe('60 gold');
  });

  it('offers no mastercrafted version of an unpriced weapon', async () => {
    items.push({ ...weapon(4, 'Unarmed', 0, '-', null, null), costCopper: null });
    const page = await render();
    items.pop();

    expect(page.row('Unarmed').querySelector('button')).toBeNull();
    await page.global(true);
    expect(page.row('Unarmed').classList).not.toContain('mastercrafted');
  });

  it('shows the source placeholder for an unpriced item', async () => {
    items.push({ ...weapon(4, 'Unarmed', 0, '-', null, null), costCopper: null });
    const page = await render();
    items.pop();

    expect(page.cost('Unarmed')).toBe('-');
    await page.sell('50');
    expect(page.cost('Unarmed')).toBe('-');
  });

  it('shows the category note and never renders currency exchange', async () => {
    const page = await render();

    expect(page.host.textContent).toContain('A mastercrafted version costs 10 times normal.');
    expect(page.host.textContent).not.toContain('Currency Exchange');
  });
});
