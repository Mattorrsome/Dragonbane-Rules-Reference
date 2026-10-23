import { ChangeDetectionStrategy, Component, model, signal } from '@angular/core';
import { BarterResult, PriceOptions, SellRate, TradeMode } from '../../money/pricing';

/** Buy/sell, sell rate and bartering result for the equipment price columns. */
@Component({
  selector: 'app-price-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-controls.html',
  host: { class: 'price-controls' },
})
export class PriceControls {
  readonly options = model.required<PriceOptions>();

  protected readonly rates: SellRate[] = [100, 50, 20, 10];
  protected readonly results: { value: BarterResult; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'success', label: 'Success' },
    { value: 'dragon', label: 'Dragon' },
  ];
  protected readonly bartering = signal(false);

  protected setMode(mode: TradeMode): void {
    this.options.update(o => ({ ...o, mode }));
  }

  protected setRate(sellRate: SellRate): void {
    this.options.update(o => ({ ...o, sellRate }));
  }

  protected setBartering(on: boolean): void {
    this.bartering.set(on);
    if (!on) this.setBarter('none');
  }

  protected setBarter(barter: BarterResult): void {
    this.options.update(o => ({ ...o, barter }));
  }
}
