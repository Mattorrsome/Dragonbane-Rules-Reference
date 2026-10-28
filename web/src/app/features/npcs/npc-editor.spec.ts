import { TestBed } from '@angular/core/testing';
import { addSpell, fromTypical, Npc } from '../../npc/npc';
import { BANDIT_CHIEF, GUARD, NPC_REFERENCE as ref } from '../../npc/npc.fixture';
import { NpcEditor } from './npc-editor';

function render(npc: Npc) {
  const fixture = TestBed.createComponent(NpcEditor);
  fixture.componentRef.setInput('npc', npc);
  fixture.componentRef.setInput('ref', ref);
  const saved: Npc[] = [];
  let cancelled = 0;
  fixture.componentInstance.saved.subscribe(n => saved.push(n));
  fixture.componentInstance.cancelled.subscribe(() => cancelled++);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const update = () => fixture.detectChanges();
  /** The control whose <label> reads `text` (or whose aria-label does). */
  const field = <T extends HTMLElement>(text: string): T => {
    const label = [...host.querySelectorAll('label')].find(l => l.textContent?.trim() === text);
    return (label ? host.querySelector(`#${label.htmlFor}`) : host.querySelector(`[aria-label="${text}"]`)) as T;
  };
  const button = (name: string) =>
    [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!;
  const type = (control: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    control.value = value;
    control.dispatchEvent(new Event('input'));
    update();
  };
  const choose = (control: HTMLSelectElement, value: string) => {
    control.value = value;
    control.dispatchEvent(new Event('change'));
    update();
  };
  const click = (name: string) => {
    button(name).click();
    update();
  };
  const chips = (list: string) => [...host.querySelectorAll(`[aria-label="${list}"] li`)].map(li => li.querySelector('.chip-name')?.textContent?.trim());
  const preview = () => host.querySelector('app-npc-card')!;
  return { host, field, button, type, choose, click, chips, preview, saved, cancelled: () => cancelled };
}

describe('NpcEditor', () => {
  it('has labelled fields filled from the NPC', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    expect(e.field<HTMLInputElement>('Name').value).toBe('Bandit chief');
    expect(e.field<HTMLInputElement>('Name').required).toBe(true);
    expect(e.field<HTMLTextAreaElement>('Description').value).toBe('');
    expect(e.field<HTMLInputElement>('Movement').value).toBe('10');
    expect(e.field<HTMLInputElement>('HP').value).toBe('30');
    expect(e.field<HTMLInputElement>('WP').value).toBe('16');
    expect(e.field<HTMLSelectElement>('STR damage bonus').value).toBe('D6');
    expect(e.field<HTMLSelectElement>('AGL damage bonus').value).toBe('');
  });

  it('lists skills, abilities, gear and spells as removable chips', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    expect(e.chips('Skills')).toEqual(['Awareness', 'Brawling', 'Hammers']);
    expect(e.field<HTMLInputElement>('Awareness level').value).toBe('12');
    expect(e.chips('Heroic abilities')).toEqual(['Berserker', 'Robust', 'Veteran']);
    expect(e.field<HTMLInputElement>('Robust count').value).toBe('6');
    expect(e.field('Berserker count')).toBeNull();
    expect(e.chips('Gear')).toEqual(['Heavy warhammer', 'Chainmail', 'Open helmet']);

    e.click('Remove Awareness');
    expect(e.chips('Skills')).toEqual(['Brawling', 'Hammers']);
  });

  it('adding a weapon adds its skill at 5', () => {
    const e = render(fromTypical(GUARD, ref));

    e.type(e.field('Gear to add'), 'Short bow');
    e.click('Add gear');

    expect(e.chips('Gear')).toEqual(['Broadsword', 'Studded leather', 'Short bow']);
    expect(e.field<HTMLInputElement>('Bows level').value).toBe('5');
    expect(e.field<HTMLInputElement>('Gear to add').value).toBe('');
  });

  it('adds skills at 5, abilities and spells picked from the list', () => {
    const e = render(fromTypical(GUARD, ref));

    e.type(e.field('Skill to add'), 'evade');
    e.click('Add skill');
    expect(e.field<HTMLInputElement>('Evade level').value).toBe('5');

    e.type(e.field('Heroic ability to add'), 'Veteran');
    e.click('Add heroic ability');
    expect(e.chips('Heroic abilities')).toEqual(['Veteran']);

    const options = [...e.host.querySelectorAll('#spell-options option')].map(o => (o as HTMLOptionElement).value);
    expect(options).toContain('Dispel (General Magic)');
    expect(options).toContain('Erase (Symbolism, trick)');
    e.type(e.field('Spell to add'), 'Dispel (General Magic)');
    e.click('Add spell');
    expect(e.chips('Spells')).toEqual(['Dispel (General Magic)']);
  });

  it('refuses a skill, ability or spell that is not in the list', () => {
    const e = render(fromTypical(GUARD, ref));

    e.type(e.field('Skill to add'), 'Juggling');
    e.click('Add skill');

    expect(e.chips('Skills')).toEqual(['Awareness', 'Swords']);
    expect(e.host.textContent).toContain('Pick a skill from the list.');
  });

  it('Robust count moves HP', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    e.type(e.field('Robust count'), '4');

    expect(e.field<HTMLInputElement>('HP').value).toBe('26');
  });

  it('clearing a count or level box while retyping changes nothing until a number is typed', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    e.type(e.field('Robust count'), '');
    expect(e.chips('Heroic abilities')).toEqual(['Berserker', 'Robust', 'Veteran']);
    expect(e.field<HTMLInputElement>('HP').value).toBe('30');
    e.type(e.field('Robust count'), '4');
    expect(e.field<HTMLInputElement>('HP').value).toBe('26');

    e.type(e.field('Awareness level'), '');
    e.click('Save');
    expect(e.saved[0].skills[0]).toEqual({ name: 'Awareness', level: 12 });
  });

  it('the preview follows the draft and shows descriptions until the box is unticked', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    e.type(e.field('Name'), 'Grok');
    expect(e.preview().querySelector('.npc-card-name')?.textContent?.trim()).toBe('Grok');
    const box = e.field<HTMLInputElement>('Show spell and heroic ability descriptions');
    expect(box.checked).toBe(true);
    expect(e.preview().querySelector('.entry-detail')).not.toBeNull();

    box.click();
    e.click('Remove Awareness');
    expect(e.preview().querySelector('.entry-detail')).toBeNull();
  });

  it('each picker sits above its chips with an unlabelled box and a plain "Add" button', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    for (const group of e.host.querySelectorAll('fieldset.chip-group')) {
      expect(group.querySelector('.picker')!.compareDocumentPosition(group.querySelector('ul.chips')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(group.querySelector('.picker label')).toBeNull();
      expect(group.querySelector('.picker .btn')?.textContent?.trim()).toBe('Add');
    }
    expect(e.field('Gear to add')).not.toBeNull();
    expect(e.button('Add gear').textContent?.trim()).toBe('Add');
  });

  it('a clear button empties the picker box and appears only while it holds text', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));
    const box = e.field<HTMLInputElement>('Spell to add');

    expect(e.button('Clear spell')).toBeUndefined();
    e.type(box, 'Dis');
    e.click('Clear spell');

    expect(box.value).toBe('');
    expect(e.button('Clear spell')).toBeUndefined();
  });

  it('each chip shows its description as a tooltip', () => {
    const npc = addSpell(fromTypical(BANDIT_CHIEF, ref), { name: 'DISPEL', school: 'General Magic', kind: 'Spell' });
    const e = render(npc);
    const title = (list: string, name: string) =>
      [...e.host.querySelectorAll(`[aria-label="${list}"] li`)].find(li => li.querySelector('.chip-name')?.textContent?.trim() === name)?.getAttribute('title');

    expect(title('Skills', 'Awareness')).toBe(ref.skills.find(s => s.name === 'Awareness')!.description);
    expect(title('Heroic abilities', 'Berserker')).toBe(ref.abilities.find(a => a.name === 'Berserker')!.effect);
    expect(title('Gear', 'Chainmail')).toBe('Armour rating 4. Bane to EVADE and SNEAKING.');
    expect(title('Spells', 'Dispel (General Magic)')).toBe(ref.spells.find(s => s.name === 'DISPEL')!.description);
  });

  it('Save needs a name and numbers of 0 or more', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    e.type(e.field('Name'), '  ');
    e.click('Save');
    expect(e.host.textContent).toContain('Name is required');
    e.type(e.field('Name'), 'Grok');
    e.type(e.field('HP'), '-1');
    e.click('Save');
    expect(e.host.textContent).toContain('HP must be 0 or more');
    expect(e.saved).toEqual([]);

    e.type(e.field('HP'), '31');
    e.click('Save');
    expect(e.saved).toHaveLength(1);
    expect(e.saved[0]).toMatchObject({ name: 'Grok', hp: 31, basedOn: 'Bandit chief' });
  });

  it('a cleared WP saves as none', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    e.type(e.field('WP'), '');
    e.click('Save');

    expect(e.saved[0].wp).toBeNull();
  });

  it('damage bonus can be removed', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    e.choose(e.field('STR damage bonus'), '');
    e.click('Save');

    expect(e.saved[0].damageBonuses).toEqual([]);
  });

  it('an NPC can have both a STR and an AGL damage bonus', () => {
    const e = render(fromTypical(BANDIT_CHIEF, ref));

    e.choose(e.field('AGL damage bonus'), 'D4');
    e.click('Save');

    expect(e.saved[0].damageBonuses).toEqual([{ attribute: 'STR', dice: 'D6' }, { attribute: 'AGL', dice: 'D4' }]);
  });

  it('Cancel emits cancelled', () => {
    const e = render(fromTypical(GUARD, ref));

    e.click('Cancel');

    expect(e.cancelled()).toBe(1);
  });
});
