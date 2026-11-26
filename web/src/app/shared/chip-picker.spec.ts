import { TestBed } from '@angular/core/testing';
import { ChipPicker } from './chip-picker';

describe('ChipPicker', () => {
  async function render(accept: (text: string) => boolean) {
    const fixture = TestBed.createComponent(ChipPicker);
    fixture.componentRef.setInput('options', ['Awareness', 'Bushcraft']);
    fixture.componentRef.setInput('noun', 'skill');
    fixture.componentRef.setInput('pickerId', 'skill');
    fixture.componentRef.setInput('accept', accept);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const box = host.querySelector('input')!;
    const type = async (value: string) => {
      box.value = value;
      box.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const click = async (label: string) => {
      host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
      await fixture.whenStable();
    };
    return { host, box, type, click };
  }

  it('lists the options in the datalist', async () => {
    const p = await render(() => true);

    expect([...p.host.querySelectorAll('datalist option')].map(o => o.getAttribute('value'))).toEqual(['Awareness', 'Bushcraft']);
  });

  it('Add hands the trimmed text to accept and clears the box when accepted', async () => {
    const accept = vi.fn().mockReturnValue(true);
    const p = await render(accept);

    await p.type('  Awareness ');
    await p.click('Add skill');

    expect(accept).toHaveBeenCalledWith('Awareness');
    expect(p.box.value).toBe('');
    expect(p.host.querySelector('.field-error')).toBeNull();
  });

  it('shows the not-found error and keeps the text when refused', async () => {
    const p = await render(() => false);

    await p.type('Nope');
    await p.click('Add skill');

    expect(p.host.querySelector('.field-error')?.textContent).toContain('Pick a skill from the list.');
    expect(p.box.value).toBe('Nope');
  });

  it('the clear button empties the box, clears the error and keeps focus in the box', async () => {
    const p = await render(() => false);
    document.body.append(p.host);

    await p.type('Nope');
    await p.click('Add skill');
    await p.click('Clear skill');

    expect(p.box.value).toBe('');
    expect(p.host.querySelector('.field-error')).toBeNull();
    expect(document.activeElement).toBe(p.box);
    p.host.remove();
  });
});
