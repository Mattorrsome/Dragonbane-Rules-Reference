import { CoinStandard } from '../api/models';
import { CurrencyRates } from '../core/currency-rates';
import { formatCoins, toDisplayCopper } from './coins';

export type TradeMode = 'buy' | 'sell';
export type SellRate = 100 | 50 | 20 | 10;
export type BarterResult = 'none' | 'success' | 'dragon';
export interface PriceOptions {
  mode: TradeMode;
  sellRate: SellRate;
  barter: BarterResult;
}

export const BASE_PRICE: PriceOptions = { mode: 'buy', sellRate: 100, barter: 'none' };

/** Barter percentage: a success shaves 20% off a purchase or adds 20% to a sale; a dragon halves or doubles. */
const BARTER_PCT: Record<TradeMode, Record<BarterResult, number>> = {
  buy: { none: 100, success: 80, dragon: 50 },
  sell: { none: 100, success: 120, dragon: 200 },
};

/** Exact (possibly fractional) copper, or null when there is no price or it cannot be sold. One integer division by 10_000. */
export function quote(baseCopper: number | null, canResell: boolean, options: PriceOptions): number | null {
  if (baseCopper === null) return null;
  if (options.mode === 'sell' && !canResell) return null;
  const ratePct = options.mode === 'buy' ? 100 : options.sellRate;
  return (baseCopper * ratePct * BARTER_PCT[options.mode][options.barter]) / 10_000;
}

export function isBasePrice(options: PriceOptions): boolean {
  return options.mode === 'buy' && options.barter === 'none';
}

/** Full display text: as-written CostText when standard 'written' and base price, else coins + unit + ' or more'. Null → '—'. */
export function formatPrice(
  exactCopper: number | null,
  standard: CoinStandard,
  rates: CurrencyRates,
  cost: { costText: string; costUnit: string | null; costOrMore: boolean },
  isBase: boolean,
): string {
  if (exactCopper === null) return '—';
  if (standard === 'written' && isBase) return cost.costText;
  return formatCoins(toDisplayCopper(exactCopper), standard, rates) + (cost.costUnit ?? '') + (cost.costOrMore ? ' or more' : '');
}
