import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { EquipmentItemDto, TreasureEntryDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { CurrencyRatesService } from '../../core/currency-rates';
import { DiceRoller } from '../../dice/dice-roller';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';
import { resolveEntry, rollTreasure, TreasureResult } from '../../treasure/treasure-resolver';
import { TreasureResultView } from './treasure-result';

@Component({
  selector: 'app-treasure-page',
  imports: [SearchBox, TreasureResultView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './treasure.page.html',
})
export class TreasurePage {
  /** Query param, bound by the router. */
  readonly search = input<string>();

  protected readonly coins = inject(CoinStandardStore);
  protected readonly rates = inject(CurrencyRatesService).rates;
  private readonly roller = inject(DiceRoller);

  /** The full table: the D40 always rolls against all 40 entries, whatever the search shows. */
  protected readonly all = httpResource<TreasureEntryDto[]>(() => '/api/treasure');
  private readonly searched = httpResource<TreasureEntryDto[]>(() => {
    const search = this.search();
    return search ? { url: '/api/treasure', params: { search } } : undefined;
  });
  protected readonly entries = computed(() => (this.search() ? this.searched : this.all));

  private readonly equipment = httpResource<EquipmentItemDto[]>(() => '/api/equipment');
  protected readonly items = computed(() => new Map((this.equipment.value() ?? []).map(i => [i.id, i])));
  protected readonly ready = computed(() => !!this.rates() && !!this.all.value() && this.equipment.hasValue());

  protected readonly result = signal<TreasureResult | null>(null);
  protected readonly setFilter = injectQueryParamWriter();

  protected rollTable(): void {
    this.result.set(rollTreasure(this.all.value()!, this.roller, this.rates()!));
  }

  protected rollEntry(entry: TreasureEntryDto): void {
    this.result.set(resolveEntry(entry, this.roller, this.rates()!));
  }
}
