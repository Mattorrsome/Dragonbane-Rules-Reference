import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoinStandard, EquipmentItemDto } from '../../api/models';
import { CurrencyRates } from '../../core/currency-rates';
import { formatCoins } from '../../money/coins';
import { mastercraft } from '../../money/mastercraft';
import { formatPrice } from '../../money/pricing';
import { describeDice } from '../../treasure/dice-format';
import { ResolvedRoll, TreasureResult } from '../../treasure/treasure-resolver';

/** One line of the result: dice arithmetic text, optionally followed by an equipment link and its price. */
interface ResultLine {
  depth: number;
  text: string;
  link?: { text: string; queryParams: Record<string, string | number> };
  suffix?: string;
}

/** Shows a resolved treasure roll with every die and its arithmetic. */
@Component({
  selector: 'app-treasure-result',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './treasure-result.html',
})
export class TreasureResultView {
  readonly result = input.required<TreasureResult>();
  readonly items = input.required<ReadonlyMap<number, EquipmentItemDto>>();
  readonly standard = input.required<CoinStandard>();
  readonly rates = input.required<CurrencyRates>();

  protected readonly lines = computed<ResultLine[]>(() => {
    const { entry, d40, rolls } = this.result();
    const lines: ResultLine[] = d40 ? [{ depth: 0, text: `D40 → ${d40.total}: ${entry.name}` }] : [];
    const walk = (roll: ResolvedRoll, depth: number) => {
      lines.push(this.describe(roll, depth));
      roll.nested.forEach(n => walk(n, depth + 1));
    };
    rolls.forEach(r => walk(r, 0));
    return lines;
  });

  /** For a grimoire: the rolled school and rank as a Spells page filter (rank 0 means tricks). */
  protected readonly spellsLink = computed(() => {
    const rolls = this.result().rolls;
    const schoolId = rolls.find(r => r.outcome?.magicSchoolId)?.outcome?.magicSchoolId;
    const rank = rolls.find(r => r.spec.purpose === 'SpellRank')?.dice.total;
    if (!schoolId || rank === undefined) return null;
    return rank <= 0 ? { schoolId, kind: 'Trick' } : { schoolId, rank };
  });

  private describe(roll: ResolvedRoll, depth: number): ResultLine {
    const dice = describeDice(roll.dice);
    const standard = this.standard();
    const rates = this.rates();
    switch (roll.spec.purpose) {
      case 'Coins': {
        // Found coins are shown as rolled; a coin standard adds the conversion. Price options never apply.
        const converted = standard !== 'written' && roll.valueCopper !== null ? ` (${formatCoins(roll.valueCopper, standard, rates)})` : '';
        return { depth, text: `${dice} ${roll.spec.coin?.toLowerCase() ?? ''}${converted}` };
      }
      case 'Pick': {
        const outcome = roll.outcome;
        if (!outcome) return { depth, text: `${dice}: no outcome` };
        const item = outcome.equipmentItemId === null ? undefined : this.items().get(outcome.equipmentItemId);
        if (item) {
          const price = outcome.isMastercrafted
            ? formatPrice(mastercraft({ costCopper: item.costCopper, strRequirement: null, durability: null }).costCopper, standard, rates, item, false)
            : formatPrice(item.costCopper, standard, rates, item, true);
          return {
            depth,
            text: `${dice}: `,
            link: { text: `${outcome.isMastercrafted ? 'Mastercrafted ' : ''}${item.name}`, queryParams: { categoryId: item.categoryId, search: item.name } },
            // Keep the source label only when it adds something, e.g. "lethal poison potency 12".
            suffix: `${item.name.toLowerCase().startsWith(outcome.label.toLowerCase()) ? '' : ` (${outcome.label})`} — ${price}`,
          };
        }
        if (outcome.valueCopper !== null) {
          const value = standard === 'written' ? outcome.valueText : formatCoins(outcome.valueCopper, standard, rates);
          return { depth, text: `${dice}: ${outcome.label} (${value})` };
        }
        return { depth, text: `${dice}: ${outcome.label}` };
      }
      default:
        return { depth, text: `${dice} ${roll.spec.label}` };
    }
  }
}
