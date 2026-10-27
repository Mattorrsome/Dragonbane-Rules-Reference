import { TestBed } from '@angular/core/testing';
import { fromTypical, Npc } from './npc';
import { GUARD, NPC_REFERENCE } from './npc.fixture';
import { NpcStore } from './npc.store';

const KEY = 'dragonbane.npcs.v1';
const guard = (): Npc => fromTypical(GUARD, NPC_REFERENCE);

/** A fresh store, as after a page reload (reads storage on creation). */
function store(): NpcStore {
  TestBed.resetTestingModule();
  return TestBed.inject(NpcStore);
}

describe('NpcStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts empty', () => {
    expect(store().npcs()).toEqual([]);
  });

  it('save gives a new NPC an id and keeps it across a reload', () => {
    const saved = store().save({ ...guard(), name: 'Sergeant Pell' });

    expect(saved.id).toMatch(/\S/);
    const reloaded = store().npcs();
    expect(reloaded.map(n => n.name)).toEqual(['Sergeant Pell']);
    expect(reloaded[0]).toEqual(saved);
  });

  it('save with an id replaces that NPC in place', () => {
    const s = store();
    const a = s.save({ ...guard(), name: 'A' });
    s.save({ ...guard(), name: 'B' });

    s.save({ ...a, name: 'A2' });

    expect(s.npcs().map(n => n.name)).toEqual(['A2', 'B']);
    expect(store().npcs().map(n => n.name)).toEqual(['A2', 'B']);
  });

  it('remove', () => {
    const s = store();
    const a = s.save({ ...guard(), name: 'A' });
    s.save({ ...guard(), name: 'B' });

    s.remove(a.id);

    expect(s.npcs().map(n => n.name)).toEqual(['B']);
    expect(store().npcs().map(n => n.name)).toEqual(['B']);
  });

  it.each([
    ['invalid JSON', '{bad'],
    ['a non-array', '{"id":"x","name":"Y"}'],
  ])('ignores %s and does not rewrite storage on load', (_, stored) => {
    localStorage.setItem(KEY, stored);

    expect(store().npcs()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe(stored);
  });

  it('drops entries without a string id and name, keeping the rest', () => {
    const good = { ...guard(), id: 'g1', name: 'Kept' };
    localStorage.setItem(KEY, JSON.stringify([good, { name: 'No id' }, { id: 7, name: 'Number id' }, null]));

    expect(store().npcs()).toEqual([good]);
  });

  it('fills missing fields of an older or hand-edited entry instead of failing later', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'x', name: 'Bare', hp: 9 }]));

    expect(store().npcs()).toEqual([{
      id: 'x', name: 'Bare', description: '', basedOn: '', movement: 10, hp: 9, wp: null, damageBonus: null,
      skills: [], abilities: [], gear: [], spells: [],
    }]);
  });

  it('picks up NPCs saved in another tab, so its own next save keeps them', () => {
    const here = store();
    here.save({ ...guard(), name: 'Here' });
    // Another tab saves on top of what it read, then the browser tells this tab.
    const other = [...JSON.parse(localStorage.getItem(KEY)!), { ...guard(), id: 'other', name: 'There' }];
    localStorage.setItem(KEY, JSON.stringify(other));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));

    expect(here.npcs().map(n => n.name)).toEqual(['Here', 'There']);
    here.save({ ...guard(), name: 'Later' });
    expect(store().npcs().map(n => n.name)).toEqual(['Here', 'There', 'Later']);
  });

  it('ignores storage events for other keys', () => {
    const here = store();
    here.save({ ...guard(), name: 'Here' });
    localStorage.setItem('dragonbane.coinStandard', 'gold');
    window.dispatchEvent(new StorageEvent('storage', { key: 'dragonbane.coinStandard' }));

    expect(here.npcs().map(n => n.name)).toEqual(['Here']);
  });

  it('keeps NPCs in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const s = store();

    s.save({ ...guard(), name: 'Session only' });

    expect(s.npcs().map(n => n.name)).toEqual(['Session only']);
  });
});
