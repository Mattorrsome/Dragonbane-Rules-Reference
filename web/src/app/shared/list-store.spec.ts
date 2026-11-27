import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NpcStore } from '../npc/npc.store';
import { ListStore, parseListFile } from './list-store';

interface Thing {
  id: string;
  name: string;
}

const KEY = 'test.list.v1';

function checkThing(entry: unknown, n: number): Thing {
  const e = entry as Partial<Thing> | null;
  if (!e || typeof e.id !== 'string' || typeof e.name !== 'string') throw new Error(`Thing ${n} is not a thing.`);
  return { id: e.id, name: e.name };
}

@Injectable({ providedIn: 'root' })
class ThingStore extends ListStore<Thing> {
  constructor() {
    super(KEY, checkThing, 'thing');
  }
}

function store(): ThingStore {
  TestBed.resetTestingModule();
  return TestBed.inject(ThingStore);
}

describe('parseListFile', () => {
  const parse = (text: string) => parseListFile(text, checkThing, 'thing');

  it('returns the checked entries', () => {
    expect(parse('[{"id":"a","name":"A"}]')).toEqual([{ id: 'a', name: 'A' }]);
  });

  it('rejects text that is not JSON, not a list, or empty', () => {
    expect(() => parse('nope')).toThrow('That file is not valid JSON.');
    expect(() => parse('{}')).toThrow('That file does not hold a list of things.');
    expect(() => parse('[]')).toThrow('That file holds no things.');
  });

  it('names the repeated id', () => {
    expect(() => parse('[{"id":"a","name":"A"},{"id":"a","name":"x"}]')).toThrow('Thing 2 ("x") has the same id as Thing 1.');
  });

  it('passes a failing entry check through', () => {
    expect(() => parse('[1]')).toThrow('Thing 1 is not a thing.');
  });
});

describe('ListStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('saves with a new id, replaces by id, and survives a reload', () => {
    const s = store();
    const a = s.save({ name: 'A' });
    s.save({ name: 'B' });
    s.save({ ...a, name: 'A2' });

    expect(a.id).toMatch(/\S/);
    expect(s.items().map(t => t.name)).toEqual(['A2', 'B']);
    expect(store().items().map(t => t.name)).toEqual(['A2', 'B']);
  });

  it('removes by id', () => {
    const s = store();
    const a = s.save({ name: 'A' });
    s.save({ name: 'B' });
    s.remove(a.id);
    expect(s.items().map(t => t.name)).toEqual(['B']);
  });

  it('skips bad stored entries on read and leaves storage alone until a save', () => {
    const raw = JSON.stringify([{ id: 'a', name: 'A' }, 7]);
    localStorage.setItem(KEY, raw);
    const s = store();
    expect(s.items().map(t => t.name)).toEqual(['A']);
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it('exports and imports, replacing by id and returning the count', () => {
    const s = store();
    s.save({ id: 'a', name: 'A' });
    expect(s.importJson('[{"id":"a","name":"A2"},{"id":"b","name":"B"}]')).toBe(2);
    expect(JSON.parse(s.exportJson())).toEqual([{ id: 'a', name: 'A2' }, { id: 'b', name: 'B' }]);
  });

  it('a bad import changes nothing', () => {
    const s = store();
    s.save({ id: 'a', name: 'A' });
    expect(() => s.importJson('[1]')).toThrow();
    expect(s.items().length).toBe(1);
  });

  it('takes the list another tab saved', () => {
    const s = store();
    localStorage.setItem(KEY, JSON.stringify([{ id: 'z', name: 'Z' }]));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(s.items().map(t => t.name)).toEqual(['Z']);
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const s = store();
    s.save({ name: 'A' });
    expect(s.items().length).toBe(1);
  });
});

describe('NpcStore on a v1 list', () => {
  beforeEach(() => localStorage.clear());

  const v1 = [
    { id: 'a', name: 'Old', damageBonus: { attribute: 'STR', dice: 'D4' } },
    { id: 'b', name: 'New' },
  ];

  it('reads legacy NPCs and imports the same array', () => {
    localStorage.setItem('dragonbane.npcs.v1', JSON.stringify(v1));
    TestBed.resetTestingModule();
    const s = TestBed.inject(NpcStore);
    expect(s.npcs().map(n => n.name)).toEqual(['Old', 'New']);
    expect(s.npcs()[0].damageBonuses).toEqual([{ attribute: 'STR', dice: 'D4' }]);
    expect(s.importJson(JSON.stringify(v1))).toBe(2);
  });
});
