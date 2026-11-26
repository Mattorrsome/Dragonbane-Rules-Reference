import { CoinStandard } from '../api/models';
import { CurrencyRates } from '../core/currency-rates';

/** Exact copper → whole copper for display: floor, minimum 1. The only rounding in the app. */
export function toDisplayCopper(exactCopper: number): number {
  return Math.max(1, Math.floor(exactCopper));
}

export const COINS = ['gold', 'silver', 'copper'] as const;
export type Coin = (typeof COINS)[number];

/** Whole copper in a standard. 'written' is treated as 'gold' (caller handles as-written text). */
export function formatCoins(copper: number, standard: CoinStandard, rates: CurrencyRates): string {
  const largest = standard === 'written' ? 'gold' : standard;
  let remaining = copper;
  const parts: string[] = [];
  for (const coin of COINS.slice(COINS.indexOf(largest))) {
    const count = Math.floor(remaining / rates[coin]);
    remaining -= count * rates[coin];
    if (count > 0) parts.push(`${count} ${coin}`);
  }
  return parts.join(' ') || '0 copper';
}

/** Whole copper as the fewest coins: { gold, silver, copper }. */
export function splitCoins(copper: number, rates: CurrencyRates): Record<Coin, number> {
  let remaining = copper;
  return Object.fromEntries(COINS.map(coin => {
    const count = Math.floor(remaining / rates[coin]);
    remaining -= count * rates[coin];
    return [coin, count];
  })) as Record<Coin, number>;
}
