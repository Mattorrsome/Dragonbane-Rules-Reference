import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoinStandard, EquipmentCategoryDto, EquipmentItemDto, SpellDto } from '../../api/models';
import { CurrencyRates } from '../../core/currency-rates';
import { formatCoins } from '../../money/coins';
import { mastercraftedItem } from '../../money/mastercraft';
import { formatPrice } from '../../money/pricing';
import { sentenceCase } from '../../shared/text';
import { grimoireRolls, ResolvedRoll, TreasureResult } from '../../treasure/treasure-resolver';
import { cellText, columnsFor } from '../equipment/columns';

/** One outcome line: text, optionally an equipment link with its stats as the equipment table shows them. */
interface ResultLine {
  depth: number;
  text: string;
  link?: { text: string; queryParams: Record<string, string | number> };
  suffix?: string;
  stats?: { label: string; value: string }[];
}

/** Shows a resolved treasure roll as outcomes only; the dice stay in the result for tests, not on screen. */
@Component({
  selector: 'app-treasure-result',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './treasure-result.html',
})
export class TreasureResultView {
  readonly result = input.required<TreasureResult>();
  readonly items = input.required<ReadonlyMap<number, EquipmentItemDto>>();
  readonly categories = input.required<ReadonlyMap<number, EquipmentCategoryDto>>();
  readonly suggested = input.required<readonly SpellDto[]>();
  readonly standard = input.required<CoinStandard>();
  readonly rates = input.required<CurrencyRates>();

  protected readonly sentenceCase = sentenceCase;

  protected readonly lines = computed<ResultLine[]>(() => {
    const lines: ResultLine[] = [];
    const walk = (roll: ResolvedRoll, depth: number) => {
      lines.push(this.describe(roll, depth));
      roll.nested.forEach(n => walk(n, depth + 1));
    };
    this.result().rolls.forEach(r => walk(r, 0));
    return lines;
  });

  /** For a grimoire: the rolled school and rank as a Spells page filter (rank 0 means tricks). */
  protected readonly spellsLink = computed(() => {
    const g = grimoireRolls(this.result());
    if (!g) return null;
    return g.rank <= 0 ? { schoolId: g.schoolId, kind: 'Trick' } : { schoolId: g.schoolId, rank: g.rank };
  });

  private describe(roll: ResolvedRoll, depth: number): ResultLine {
    const total = roll.dice.total;
    const standard = this.standard();
    switch (roll.spec.purpose) {
      case 'Coins': {
        // Found coins are shown as rolled; a coin standard adds the conversion. Price options never apply.
        const converted = standard !== 'written' && roll.valueCopper !== null ? ` (${formatCoins(roll.valueCopper, standard, this.rates())})` : '';
        return { depth, text: `${total} ${roll.spec.coin?.toLowerCase() ?? ''}${converted}` };
      }
      case 'SpellRank':
        return { depth, text: total <= 0 ? 'Tricks' : `Rank ${total}` };
      case 'Pick': {
        const outcome = roll.outcome;
        if (!outcome) return { depth, text: `${sentenceCase(roll.spec.label)}: -` };
        const item = outcome.equipmentItemId === null ? undefined : this.items().get(outcome.equipmentItemId);
        if (item) {
          return {
            depth,
            text: '',
            link: { text: `${outcome.isMastercrafted ? 'Mastercrafted ' : ''}${item.name}`, queryParams: { categoryId: item.categoryId, search: item.name } },
            // Keep the source label only when it adds something, e.g. "healing potion 2D6 HP".
            suffix: item.name.toLowerCase().startsWith(outcome.label.toLowerCase()) ? '' : ` (${outcome.label})`,
            stats: this.stats(item, outcome.isMastercrafted),
          };
        }
        if (outcome.valueCopper !== null) {
          const value = standard === 'written' ? outcome.valueText : formatCoins(outcome.valueCopper, standard, this.rates());
          return { depth, text: `${sentenceCase(outcome.label)} — ${value}` };
        }
        return { depth, text: `${sentenceCase(roll.spec.label)}: ${outcome.label}` };
      }
      default:
        return { depth, text: `${total} ${roll.spec.label}` };
    }
  }

  /** The item's row from its equipment table, minus list-only columns; mastercrafted values when it is mastercrafted. */
  private stats(item: EquipmentItemDto, mastercrafted: boolean): ResultLine['stats'] {
    const category = this.categories().get(item.categoryId);
    if (!category) return [];
    const shown = mastercrafted ? mastercraftedItem(item) : item;
    return columnsFor(category, item)
      .filter(c => !c.listOnly)
      .map(c => ({
        label: c.header,
        // A mastercrafted price is always calculated, so it is never shown "as written".
        value: !c.cost ? cellText(c.value(shown))
          : shown.costCopper === null ? item.costText
          : formatPrice(shown.costCopper, this.standard(), this.rates(), item, !mastercrafted),
      }));
  }
}
