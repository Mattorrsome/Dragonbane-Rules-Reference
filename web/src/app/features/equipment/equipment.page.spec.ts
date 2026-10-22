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
  weapon: { grip: '1H', strRequirement: str, range: '2', damage: '2D8', durability, isRanged: false, featuresText: 'Toppling, slashing' },
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
      const select = host.querySelector<HTMLSelectElement>('#sell-rate')!;
      select.value = rate;
      select.dispatchEvent(new Event('change'));
      await settle();
    };
    return { host, cost, sell, settle };
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

  it('mastercrafted row', async () => {
    const page = await render();
    const row = [...page.host.querySelectorAll('tbody tr')].find(tr => tr.textContent?.includes('Battleaxe'))!;
    const toggle = row.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    await page.settle();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const detail = page.host.querySelector(`#${toggle.getAttribute('aria-controls')}`)!.textContent!;
    expect(detail).toContain('STR 10');
    expect(detail).toContain('Durability 12');
    expect(detail).toContain('100 gold');
  });

  it('offers no mastercrafted version of an unpriced weapon', async () => {
    items.push({ ...weapon(4, 'Unarmed', 0, '-', null, null), costCopper: null });
    const page = await render();
    items.pop();

    const row = [...page.host.querySelectorAll('tbody tr')].find(tr => tr.textContent?.includes('Unarmed'))!;
    expect(row.querySelector('button')).toBeNull();
  });

  it('shows the category note and never renders currency exchange', async () => {
    const page = await render();

    expect(page.host.textContent).toContain('A mastercrafted version costs 10 times normal.');
    expect(page.host.textContent).not.toContain('Currency Exchange');
  });
});
