import { Injectable, computed } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { CurrencyRateDto } from '../api/models';

/** Copper per coin, from the API's currency exchange table (never rendered). */
export interface CurrencyRates {
  readonly copper: number;
  readonly silver: number;
  readonly gold: number;
}

@Injectable({ providedIn: 'root' })
export class CurrencyRatesService {
  private readonly resource = httpResource<CurrencyRateDto[]>(() => '/api/currency-rates');

  readonly rates = computed<CurrencyRates | undefined>(() => {
    const rows = this.resource.value();
    if (!rows) return undefined;
    const byName = (name: string) => rows.find(r => r.name === name)?.copperValue;
    const [copper, silver, gold] = [byName('Copper'), byName('Silver'), byName('Gold')];
    return copper && silver && gold ? { copper, silver, gold } : undefined;
  });
}
