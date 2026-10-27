import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, InjectionToken, input, signal, viewChild } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { EquipmentCategoryDto, EquipmentItemDto, SpellDto, TreasureEntryDto } from '../../api/models';
import { CoinStandardStore } from '../../core/coin-standard.store';
import { CurrencyRatesService } from '../../core/currency-rates';
import { DiceRoller } from '../../dice/dice-roller';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';
import { suggestSpells } from '../../treasure/spell-suggestions';
import { grimoireRolls, resolveEntry, rollTreasure, TreasureResult } from '../../treasure/treasure-resolver';
import { TreasureResultView } from './treasure-result';

/** How long the dialog shows the rolling spinner before the result. The roll itself is instant; the pause is for the table. */
export const ROLL_DELAY_MS = new InjectionToken<number>('ROLL_DELAY_MS', { factory: () => 500 });

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

  private readonly rollDelayMs = inject(ROLL_DELAY_MS);
  /** True while the spinner shows; the result is already rolled and waits for the delay. */
  protected readonly rolling = signal(false);
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
    if (!this.rolling()) this.rerun?.();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** A click on the backdrop lands on the dialog element itself, outside its box: close, as a light dismiss. */
  protected closeOnBackdrop(event: MouseEvent): void {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  }

  /** Opens the dialog on the spinner, then shows the result once the delay is up. */
  private show(result: TreasureResult): void {
    const suggested = this.grimoire(result);
    this.rolling.set(true);
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
    setTimeout(() => {
      this.result.set(result);
      this.suggested.set(suggested);
      this.rolling.set(false);
    }, this.rollDelayMs);
  }

  private grimoire(result: TreasureResult): SpellDto[] {
    const g = grimoireRolls(result);
    return g ? suggestSpells(this.spells.value()!, g.schoolId, g.rank, g.count, this.roller) : [];
  }
}
