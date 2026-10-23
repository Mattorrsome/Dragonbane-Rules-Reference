import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { EquipmentCategoryDto, EquipmentItemDto, SpellDto, TreasureEntryDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { CurrencyRatesService } from '../../core/currency-rates';
import { DiceRoller } from '../../dice/dice-roller';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';
import { suggestSpells } from '../../treasure/spell-suggestions';
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
    const search = this.search()?.trim();
    return search ? { url: '/api/treasure', params: { search } } : undefined;
  });
  protected readonly entries = computed(() => (this.search()?.trim() ? this.searched : this.all));

  private readonly equipment = httpResource<EquipmentItemDto[]>(() => '/api/equipment');
  protected readonly items = computed(() => new Map((this.equipment.value() ?? []).map(i => [i.id, i])));
  private readonly categoryList = httpResource<EquipmentCategoryDto[]>(() => '/api/equipment-categories');
  protected readonly categories = computed(() => new Map((this.categoryList.value() ?? []).map(c => [c.id, c])));
  private readonly spells = httpResource<SpellDto[]>(() => '/api/spells');
  protected readonly ready = computed(
    () => !!this.rates() && !!this.all.value() && this.equipment.hasValue() && this.categoryList.hasValue() && this.spells.hasValue(),
  );

  protected readonly result = signal<TreasureResult | null>(null);
  /** A grimoire's suggested spells, rolled with the result; empty for anything else. */
  protected readonly suggested = signal<readonly SpellDto[]>([]);
  protected readonly setFilter = injectQueryParamWriter();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  /** Repeats the last roll: the D40 after a table roll, the same entry after a row roll. */
  private rerun: (() => void) | null = null;

  protected rollTable(): void {
    this.rerun = () => this.rollTable();
    this.show(rollTreasure(this.all.value()!, this.roller, this.rates()!));
  }

  protected rollEntry(entry: TreasureEntryDto): void {
    this.rerun = () => this.rollEntry(entry);
    this.show(resolveEntry(entry, this.roller, this.rates()!));
  }

  protected rollAgain(): void {
    this.rerun?.();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  private show(result: TreasureResult): void {
    this.result.set(result);
    this.suggested.set(this.grimoire(result));
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  private grimoire({ rolls }: TreasureResult): SpellDto[] {
    const schoolId = rolls.find(r => r.outcome?.magicSchoolId)?.outcome?.magicSchoolId;
    const rank = rolls.find(r => r.spec.purpose === 'SpellRank')?.dice.total;
    const count = rolls.find(r => r.spec.purpose === 'Number')?.dice.total;
    if (!schoolId || rank === undefined || count === undefined) return [];
    return suggestSpells(this.spells.value()!, schoolId, rank, count, this.roller);
  }
}
