import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { EquipmentCategoryDto, EquipmentItemDto, SupplyDto, WeaponFeatureDto, WeaponTermDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { CurrencyRatesService } from '../../core/currency-rates';
import { mastercraft } from '../../money/mastercraft';
import { BASE_PRICE, formatPrice, isBasePrice, PriceOptions, quote } from '../../money/pricing';
import { definedOnly } from '../../shared/http';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';
import { PriceControls } from './price-controls';

/** One table column: header text plus how to read the cell from an item ('cost' is priced live). */
interface Column {
  header: string;
  value: (item: EquipmentItemDto) => string | number | null | undefined;
  cost?: true;
}

interface CategorySection {
  category: EquipmentCategoryDto;
  columns: Column[];
  items: EquipmentItemDto[];
  isWeapon: boolean;
}

const COST: Column = { header: 'Cost', value: () => null, cost: true };
const SUPPLY: Column = { header: 'Supply', value: i => i.supply };

/** Columns as the source tables have them, per kind of category. */
function columnsFor(category: EquipmentCategoryDto, sample: EquipmentItemDto | undefined): Column[] {
  if (sample?.weapon) {
    return [
      { header: 'Grip', value: i => i.weapon?.grip },
      { header: 'STR', value: i => i.weapon?.strRequirement },
      { header: 'Range', value: i => i.weapon?.range },
      { header: 'Damage', value: i => i.weapon?.damage },
      { header: 'Durability', value: i => i.weapon?.durability },
      COST,
      SUPPLY,
      { header: 'Features', value: i => i.weapon?.featuresText },
    ];
  }
  if (sample?.armour) {
    return [
      { header: 'Rating', value: i => (i.armour?.isHelmet ? `+${i.armour.rating}` : i.armour?.rating) },
      COST,
      SUPPLY,
      { header: 'Effect', value: i => i.effect },
    ];
  }
  return [
    COST,
    SUPPLY,
    ...(category.hasWeight ? [{ header: 'Weight', value: (i: EquipmentItemDto) => i.weight }] : []),
    ...(category.effectHeader ? [{ header: category.effectHeader, value: (i: EquipmentItemDto) => i.effect }] : []),
  ];
}

@Component({
  selector: 'app-equipment-page',
  imports: [SearchBox, PriceControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipment.page.html',
})
export class EquipmentPage {
  /** Query params, bound by the router. */
  readonly search = input<string>();
  readonly categoryId = input<string>();

  protected readonly coins = inject(CoinStandardStore);
  private readonly rates = inject(CurrencyRatesService).rates;
  protected readonly options = signal<PriceOptions>(BASE_PRICE);
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());

  protected readonly categories = httpResource<EquipmentCategoryDto[]>(() => '/api/equipment-categories');
  protected readonly items = httpResource<EquipmentItemDto[]>(() => ({
    url: '/api/equipment',
    params: definedOnly({ search: this.search(), categoryId: this.categoryId() }),
  }));
  protected readonly supplies = httpResource<SupplyDto[]>(() => '/api/supplies');
  protected readonly weaponTerms = httpResource<WeaponTermDto[]>(() => '/api/weapon-terms');
  protected readonly weaponFeatures = httpResource<WeaponFeatureDto[]>(() => '/api/weapon-features');
  protected readonly setFilter = injectQueryParamWriter();

  /** One section per category that has matching items, in category order. */
  protected readonly sections = computed<CategorySection[]>(() => {
    const items = this.items.value() ?? [];
    return (this.categories.value() ?? [])
      .map(category => {
        const own = items.filter(i => i.categoryId === category.id);
        return { category, items: own, columns: columnsFor(category, own[0]), isWeapon: !!own[0]?.weapon };
      })
      .filter(s => s.items.length > 0);
  });

  protected cell(column: Column, item: EquipmentItemDto, category: EquipmentCategoryDto): string {
    if (column.cost) return this.price(item, item.costCopper, category, isBasePrice(this.options()));
    const value = column.value(item);
    return value === null || value === undefined || value === '' ? '-' : String(value);
  }

  protected mastercrafted(item: EquipmentItemDto, category: EquipmentCategoryDto): string {
    const mc = mastercraft({
      costCopper: item.costCopper,
      strRequirement: item.weapon?.strRequirement ?? null,
      durability: item.weapon?.durability ?? null,
    });
    // A mastercrafted price is always calculated, so it is never shown "as written".
    return `STR ${mc.strRequirement ?? '-'} · Durability ${mc.durability ?? '-'} · Cost ${this.price(item, mc.costCopper, category, false)}`;
  }

  protected toggle(id: number): void {
    this.expanded.update(open => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected onCategory(event: Event): void {
    this.setFilter({ categoryId: (event.target as HTMLSelectElement).value || null });
  }

  private price(item: EquipmentItemDto, copper: number | null, category: EquipmentCategoryDto, isBase: boolean): string {
    const rates = this.rates();
    if (!rates) return '…';
    return formatPrice(quote(copper, category.canResell, this.options()), this.coins.standard(), rates, item, isBase);
  }
}
