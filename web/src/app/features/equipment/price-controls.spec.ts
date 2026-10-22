import { TestBed } from '@angular/core/testing';
import { BASE_PRICE } from '../../money/pricing';
import { PriceControls } from './price-controls';

describe('PriceControls', () => {
  async function render() {
    const fixture = TestBed.createComponent(PriceControls);
    fixture.componentRef.setInput('options', BASE_PRICE);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const click = async (selector: string) => {
      host.querySelector<HTMLInputElement>(selector)!.click();
      await fixture.whenStable();
    };
    return { fixture, host, click };
  }

  it('hides the sell rate while buying', async () => {
    const { host, click } = await render();
    expect(host.querySelector('#sell-rate')).toBeNull();

    await click('input[name="price-mode"][value="sell"]');

    expect(host.querySelector('#sell-rate')).not.toBeNull();
  });

  it('bartering toggle resets result', async () => {
    const { fixture, click } = await render();

    await click('#bartering');
    await click('input[name="barter-result"][value="success"]');
    expect(fixture.componentInstance.options().barter).toBe('success');

    await click('#bartering');
    expect(fixture.componentInstance.options().barter).toBe('none');
  });
});
