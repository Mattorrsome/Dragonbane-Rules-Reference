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

  it('shows the sell rate radios only while selling', async () => {
    const { host, click } = await render();
    expect(host.querySelectorAll('input[name="sell-rate"]').length).toBe(0);

    await click('input[name="price-mode"][value="sell"]');

    expect([...host.querySelectorAll<HTMLInputElement>('input[name="sell-rate"]')].map(r => r.value)).toEqual(['100', '50', '20', '10']);
  });

  it('sell rate radio sets 20', async () => {
    const { fixture, click } = await render();
    await click('input[name="price-mode"][value="sell"]');

    await click('input[name="sell-rate"][value="20"]');

    expect(fixture.componentInstance.options().sellRate).toBe(20);
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
