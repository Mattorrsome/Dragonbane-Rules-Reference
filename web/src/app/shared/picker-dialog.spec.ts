import { TestBed } from '@angular/core/testing';
import { PickerGroup } from '../hero/picker-groups';
import { PickerDialog } from './picker-dialog';

describe('PickerDialog', () => {
  const groups: PickerGroup[] = [
    {
      heading: 'Animism',
      items: [
        { id: 'fireball', label: 'Fireball', description: 'Rank 1\n\nA ball of fire.', added: true },
        { id: 'frost', label: 'Frost', description: 'Cold.', added: false },
      ],
    },
    {
      heading: 'Heroic abilities',
      items: [
        { id: 'berserker', label: 'Berserker', description: 'Rage.', added: false },
        { id: 'catlike', label: 'Catlike', description: 'Land on your feet.', added: false },
      ],
    },
  ];

  beforeEach(() => {
    // jsdom has no modal dialog; the browser behaviour is covered by the e2e test.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  });

  async function render(accept: (id: string) => string | null = () => null, custom = false) {
    const fixture = TestBed.createComponent(PickerDialog);
    fixture.componentRef.setInput('buttonLabel', 'Add spell…');
    fixture.componentRef.setInput('heading', 'Add a spell');
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('accept', accept);
    fixture.componentRef.setInput('custom', custom);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    document.body.append(host);
    const dialog = host.querySelector('dialog')!;
    const filter = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
    const stable = () => fixture.whenStable();
    const open = async () => {
      host.querySelector<HTMLButtonElement>('button:not(.dialog-close)')!.click();
      await stable();
    };
    const type = async (value: string) => {
      filter().value = value;
      filter().dispatchEvent(new Event('input'));
      await stable();
    };
    const key = async (name: string) => {
      filter().dispatchEvent(new KeyboardEvent('keydown', { key: name }));
      await stable();
    };
    const options = () => [...host.querySelectorAll<HTMLElement>('[role="option"]')];
    const labels = () => options().map(o => o.textContent!.trim());
    const active = () => document.getElementById(filter().getAttribute('aria-activedescendant')!);
    return { host, dialog, filter, open, type, key, options, labels, active, stable };
  }

  afterEach(() => document.body.replaceChildren());

  it('opens a modal dialog named by its heading, with the filter focused', async () => {
    const p = await render();
    expect(p.host.querySelector('button')!.textContent!.trim()).toBe('Add spell…');

    await p.open();

    expect(p.dialog.open).toBe(true);
    expect(p.dialog.classList).toContain('picker-dialog');
    const title = document.getElementById(p.dialog.getAttribute('aria-labelledby')!)!;
    expect(title.tagName).toBe('H2');
    expect(title.textContent).toContain('Add a spell');
    expect(document.activeElement).toBe(p.filter());
    expect(p.host.querySelector(`label[for="${p.filter().id}"]`)!.textContent!.trim()).toBe('Filter');
  });

  it('lists a labelled group per heading with its options, marking added ones', async () => {
    const p = await render();
    await p.open();

    const listbox = p.host.querySelector('[role="listbox"]')!;
    expect(p.filter().getAttribute('aria-controls')).toBe(listbox.id);
    const named = [...listbox.querySelectorAll('[role="group"]')].map(g => document.getElementById(g.getAttribute('aria-labelledby')!)!.textContent!.trim());
    expect(named).toEqual(['Animism', 'Heroic abilities']);
    expect(p.labels()).toEqual(['Fireball added', 'Frost', 'Berserker', 'Catlike']);
  });

  it('filters by label, ignoring case', async () => {
    const p = await render();
    await p.open();

    await p.type('f');

    expect(p.labels()).toEqual(['Fireball added', 'Frost']);
    expect(p.host.querySelectorAll('[role="group"]').length).toBe(1);
  });

  it('arrow keys move the active option across groups and clamp at the ends', async () => {
    const p = await render();
    await p.open();
    expect(p.active()!.textContent).toContain('Fireball');

    await p.key('ArrowUp');
    expect(p.active()!.textContent).toContain('Fireball');
    await p.key('ArrowDown');
    expect(p.active()!.textContent).toContain('Frost');
    await p.key('ArrowDown');
    expect(p.active()!.textContent).toContain('Berserker');
    for (let i = 0; i < 4; i++) await p.key('ArrowDown');
    expect(p.active()!.textContent).toContain('Catlike');
    await p.key('ArrowUp');
    expect(p.active()!.textContent).toContain('Berserker');
    expect(p.active()!.getAttribute('aria-selected')).toBe('true');
  });

  it('shows the active or hovered option’s description on the right', async () => {
    const p = await render();
    await p.open();
    const pane = () => p.host.querySelector('.picker-dialog-description')!;
    expect(pane().querySelector('h3')!.textContent).toBe('Fireball');
    expect(pane().querySelector('p')!.textContent).toBe('Rank 1\n\nA ball of fire.');
    expect(pane().querySelector('p')!.classList).toContain('multiline');

    p.options()[3].dispatchEvent(new MouseEvent('mouseenter'));
    await p.stable();

    expect(pane().querySelector('h3')!.textContent).toBe('Catlike');
  });

  it('Enter picks the active option; a null result closes the dialog', async () => {
    const accept = vi.fn().mockReturnValue(null);
    const p = await render(accept);
    await p.open();

    await p.key('ArrowDown');
    await p.key('Enter');

    expect(accept).toHaveBeenCalledWith('frost');
    expect(p.dialog.open).toBe(false);
  });

  it('a message from accept shows as an alert and keeps the dialog open; reopening clears it and the filter', async () => {
    const p = await render(() => 'Fireball is already known.');
    await p.open();
    await p.type('fire');

    p.options()[0].click();
    await p.stable();

    expect(p.dialog.open).toBe(true);
    expect(p.host.querySelector('[role="alert"]')!.textContent).toContain('Fireball is already known.');

    p.host.querySelector<HTMLButtonElement>('.dialog-close')!.click();
    await p.stable();
    expect(p.dialog.open).toBe(false);

    await p.open();
    expect(p.filter().value).toBe('');
    expect(p.labels().length).toBe(4);
    expect(p.host.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows No matches, without a custom option unless custom is on', async () => {
    const p = await render();
    await p.open();

    await p.type('zzz');

    expect(p.host.textContent).toContain('No matches');
    expect(p.options()).toEqual([]);
  });

  it('with custom on, offers the typed text as the one option', async () => {
    const accept = vi.fn().mockReturnValue(null);
    const p = await render(accept, true);
    await p.open();

    await p.type('Rope ladder');
    expect(p.host.textContent).toContain('No matches');
    expect(p.labels()).toEqual(['Add “Rope ladder”']);

    await p.key('Enter');
    expect(accept).toHaveBeenCalledWith('Rope ladder');
  });

  it('a click on the backdrop closes the dialog', async () => {
    const p = await render();
    await p.open();

    p.dialog.dispatchEvent(new MouseEvent('mousedown', { clientX: -5, clientY: -5, bubbles: true }));
    p.dialog.dispatchEvent(new MouseEvent('click', { clientX: -5, clientY: -5, bubbles: true }));

    expect(p.dialog.open).toBe(false);
  });
});
