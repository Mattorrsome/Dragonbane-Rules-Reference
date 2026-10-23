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

  it('bartering results are always shown, None first and selected, with no checkbox', async () => {
    const { host } = await render();

    const results = [...host.querySelectorAll<HTMLInputElement>('input[name="barter-result"]')];
    expect(results.map(r => r.value)).toEqual(['none', 'success', 'dragon']);
    expect(results[0].checked).toBe(true);
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    expect(results[0].closest('fieldset')?.textContent).toContain('Roll:');
  });

  it('bartering result can be picked and set back to None', async () => {
    const { fixture, click } = await render();

    await click('input[name="barter-result"][value="success"]');
    expect(fixture.componentInstance.options().barter).toBe('success');

    await click('input[name="barter-result"][value="none"]');
    expect(fixture.componentInstance.options().barter).toBe('none');
  });

  it('bartering sits on its own line below Price and Sell rate', async () => {
    const { host, click } = await render();
    await click('input[name="price-mode"][value="sell"]');

    const [row, barter] = [...host.children];
    expect(row.classList).toContain('price-row');
    expect([...row.querySelectorAll('legend')].map(l => l.textContent)).toEqual(['Price', 'Sell rate']);
    expect(barter.querySelector('legend')?.textContent).toBe('Bartering');
  });
});
