import { TreasureEntryDto, TreasureOutcomeDto, TreasureRollDto } from '../api/models';
import { CurrencyRates } from '../core/currency-rates';
import { DiceRoller, RolledDice, rollDice } from '../dice/dice-roller';

export interface ResolvedRoll {
  spec: TreasureRollDto;
  dice: RolledDice;
  outcome: TreasureOutcomeDto | null;
  valueCopper: number | null;
  nested: ResolvedRoll[];
}

export interface TreasureResult {
  entry: TreasureEntryDto;
  /** The D40 that chose the entry, or null when the entry was chosen directly. */
  d40: RolledDice | null;
  rolls: ResolvedRoll[];
}

/** Rolls every dice spec of one entry. Dice come only from the API's roll specs, never from effect text. */
export function resolveEntry(entry: TreasureEntryDto, roller: DiceRoller, rates: CurrencyRates): TreasureResult {
  return { entry, d40: null, rolls: entry.rolls.map(spec => resolveRoll(spec, roller, rates)) };
}

/** Rolls D40 to pick the entry by its Roll number, then resolves it. */
export function rollTreasure(entries: readonly TreasureEntryDto[], roller: DiceRoller, rates: CurrencyRates): TreasureResult {
  const d40 = rollDice(roller, 1, 40);
  const entry = entries.find(e => e.roll === d40.total);
  if (!entry) throw new Error(`No treasure entry for roll ${d40.total}`);
  return { ...resolveEntry(entry, roller, rates), d40 };
}

function resolveRoll(spec: TreasureRollDto, roller: DiceRoller, rates: CurrencyRates): ResolvedRoll {
  const dice = rollDice(roller, spec.diceCount, spec.dieSides, spec.modifier, spec.multiplier);
  switch (spec.purpose) {
    case 'Coins':
      return { spec, dice, outcome: null, valueCopper: dice.total * coinValue(spec.coin, rates), nested: [] };
    case 'Pick': {
      const outcome = spec.outcomes.find(o => o.face === dice.total) ?? null;
      return {
        spec, dice, outcome,
        valueCopper: outcome?.valueCopper ?? null,
        nested: (outcome?.rolls ?? []).map(r => resolveRoll(r, roller, rates)),
      };
    }
    default:
      return { spec, dice, outcome: null, valueCopper: null, nested: [] };
  }
}

function coinValue(coin: string | null, rates: CurrencyRates): number {
  const key = coin?.toLowerCase();
  if (key !== 'copper' && key !== 'silver' && key !== 'gold') throw new Error(`Unknown coin ${coin}`);
  return rates[key];
}
