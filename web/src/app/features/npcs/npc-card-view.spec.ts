import { TestBed } from '@angular/core/testing';
import { NpcCard } from '../../npc/npc-card';
import { NpcCardView } from './npc-card-view';

const grok: NpcCard = {
  name: 'Grok', description: 'Scarred chief.', movement: 10, damageBonus: 'STR: +D6', armour: 'Chainmail, open helmet (5)',
  hp: 30, wp: 16, skills: 'Awareness 12, Brawling 15',
  abilities: [{ text: 'Berserker (3 WP)', detail: 'Become Angry.' }, { text: 'Robust ×6', detail: null }],
  weapons: 'Heavy warhammer (skill level 15, damage 2D10)', spells: [], gear: '', attributes: null,
};

function render(card: NpcCard): HTMLElement {
  const fixture = TestBed.createComponent(NpcCardView);
  fixture.componentRef.setInput('card', card);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const labels = (host: HTMLElement) => [...host.querySelectorAll('.npc-card b')].map(b => b.textContent?.trim());

describe('NpcCardView', () => {
  it('shows the rows in book order with the name as the banner', () => {
    const host = render(grok);

    expect(host.querySelector('.npc-card')).not.toBeNull();
    expect(host.querySelector('.npc-card-name')?.textContent?.trim()).toBe('Grok');
    expect(labels(host)).toEqual(['Movement:', 'Damage Bonus:', 'Armor:', 'HP:', 'WP:', 'Skills:', 'Heroic Abilities:', 'Weapons:']);
    expect(host.textContent).toContain('STR: +D6');
  });

  it('hides empty rows and parts', () => {
    const host = render({ ...grok, description: '', damageBonus: null, armour: null, wp: null, skills: '', abilities: [] });

    expect(labels(host)).toEqual(['Movement:', 'HP:', 'Weapons:']);
    expect(host.querySelector('.npc-card-description')).toBeNull();
  });

  it('puts each description in smaller text under its entry', () => {
    const host = render(grok);

    expect([...host.querySelectorAll('.entry-detail')].map(d => d.textContent?.trim())).toEqual(['Become Angry.']);
    expect(host.textContent).toContain('Robust ×6');
  });
});
