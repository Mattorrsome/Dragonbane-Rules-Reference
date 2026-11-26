import { CurrencyRates } from '../core/currency-rates';
import { formatCoins } from '../money/coins';
import { GearItem } from './character';

/** "2 × Rope (hemp)": the quantity only above 1, the note only when there is one. */
export function gearLabel(g: GearItem): string {
  return `${g.quantity > 1 ? `${g.quantity} × ` : ''}${g.name}${g.note ? ` (${g.note})` : ''}`;
}

/** Copper as gold, silver and copper, or plain copper while the rates have not loaded. */
export function moneyText(copper: number, rates: CurrencyRates | null | undefined): string {
  return rates ? formatCoins(copper, 'gold', rates) : `${copper} copper`;
}
