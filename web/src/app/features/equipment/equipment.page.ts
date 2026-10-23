import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { EquipmentCategoryDto, EquipmentItemDto, SupplyDto, WeaponFeatureDto, WeaponTermDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { CurrencyRatesService } from '../../core/currency-rates';
import { mastercraftedItem } from '../../money/mastercraft';
import { BASE_PRICE, formatPrice, isBasePrice, PriceOptions, quote } from '../../money/pricing';
import { definedOnly } from '../../shared/http';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';
import { cellText, Column, columnsFor } from './columns';
import { PriceControls } from './price-controls';

interface CategorySection {
  category: EquipmentCategoryDto;
  columns: Column[];
  items: EquipmentItemDto[];
  isWeapon: boolean;
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
  /** Rows switched to mastercrafted with their own button. */
  protected readonly mastercrafted = signal<ReadonlySet<number>>(new Set());
  protected readonly allMastercrafted = signal(false);

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
    // No price in the source (Unarmed, blunt objects): show its own placeholder, whatever the price options.
    if (column.cost && item.costCopper === null) return item.costText;
    const mc = this.isMastercrafted(item);
    const shown = mc ? mastercraftedItem(item) : item;
    // A mastercrafted price is always calculated, so it is never shown "as written".
    if (column.cost) return this.price(item, shown.costCopper, category, !mc && isBasePrice(this.options()));
    return cellText(column.value(shown));
  }

  /** The mastercrafted rule is in the Melee weapons note, so only priced melee weapons have a version. */
  protected canMastercraft(item: EquipmentItemDto): boolean {
    return !!item.weapon && !item.weapon.isRanged && item.costCopper !== null;
  }

  /** The global toggle overrides the row buttons; turning it off brings back each row's own choice. */
  protected isMastercrafted(item: EquipmentItemDto): boolean {
    return this.canMastercraft(item) && (this.allMastercrafted() || this.mastercrafted().has(item.id));
  }

  protected toggle(id: number): void {
    this.mastercrafted.update(open => {
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
