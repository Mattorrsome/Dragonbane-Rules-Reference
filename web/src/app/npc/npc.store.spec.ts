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
      id: 'x', name: 'Bare', description: '', basedOn: '', movement: 10, hp: 9, wp: null, damageBonuses: [],
      skills: [], abilities: [], gear: [], spells: [],
    }]);
  });

  it("reads an older entry's single damage bonus as a list", () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'x', name: 'Old', damageBonus: { attribute: 'AGL', dice: 'D4' } }]));

    expect(store().npcs()[0].damageBonuses).toEqual([{ attribute: 'AGL', dice: 'D4' }]);
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

  it('exports every saved NPC as JSON that imports back unchanged', () => {
    const s = store();
    s.save({ ...guard(), name: 'A' });
    s.save({ ...guard(), name: 'B' });
    const json = s.exportJson();
    localStorage.clear();

    const fresh = store();
    expect(fresh.importJson(json)).toBe(2);
    expect(fresh.npcs()).toEqual(s.npcs());
  });

  it('import replaces NPCs with the same id, adds new ones and keeps the rest', () => {
    const s = store();
    const a = s.save({ ...guard(), name: 'A' });
    s.save({ ...guard(), name: 'B' });

    s.importJson(JSON.stringify([{ ...a, name: 'A from file' }, { ...guard(), id: 'new', name: 'C' }]));

    expect(s.npcs().map(n => n.name)).toEqual(['A from file', 'B', 'C']);
    expect(store().npcs().map(n => n.name)).toEqual(['A from file', 'B', 'C']);
  });

  it('import fills fields an older export lacks', () => {
    expect(store().importJson(JSON.stringify([{ id: 'x', name: 'Bare' }]))).toBe(1);
    expect(store().npcs()[0].skills).toEqual([]);
  });

  it('import stops at the first bad entry, says what is wrong and saves none of the file', () => {
    const s = store();

    expect(() => s.importJson(JSON.stringify([{ id: 'x', name: 'Fine' }, { id: 'y', name: 'Broken', skills: [null] }]))).toThrow(
      'NPC 2 ("Broken"): skill 1 needs a name and a level of 0 or more.',
    );
    expect(store().npcs()).toEqual([]);
  });

  it('drops a stored entry with a broken list instead of breaking the page', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'x', name: 'Bad', gear: [5] }, { ...guard(), id: 'g', name: 'Good' }]));

    expect(store().npcs().map(n => n.name)).toEqual(['Good']);
  });

  it.each([
    ['invalid JSON', '{bad'],
    ['a non-array', '{"id":"x","name":"Y"}'],
    ['no readable NPCs', '[{"name":"No id"}]'],
  ])('import refuses %s and changes nothing', (_, text) => {
    const s = store();
    s.save({ ...guard(), name: 'Kept' });

    expect(() => s.importJson(text)).toThrow();
    expect(store().npcs().map(n => n.name)).toEqual(['Kept']);
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
