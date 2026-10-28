import { DAMAGE_BONUS_ATTRIBUTES, DamageBonus, DEFAULT_MOVEMENT, NpcSpellRef, SavedNpc } from './npc';

const DICE = ['D4', 'D6'];
const SPELL_KINDS = ['Spell', 'Trick', 'Recipe'];

/**
 * Reads an NPC file (an export of My NPCs). Stops at the first problem and throws an Error whose message says what
 * and where, in words a GM can act on; nothing is returned in that case, so a bad file imports nothing.
 */
export function parseNpcFile(text: string): SavedNpc[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('That file does not hold a list of NPCs.');
  if (!parsed.length) throw new Error('That file holds no NPCs.');

  const firstWithId = new Map<string, number>();
  return parsed.map((entry, i) => {
    const npc = checkNpc(entry, i + 1);
    const earlier = firstWithId.get(npc.id);
    if (earlier) throw new Error(`NPC ${i + 1} ("${npc.name}") has the same id as NPC ${earlier}.`);
    firstWithId.set(npc.id, i + 1);
    return npc;
  });
}

/**
 * Checks one saved or imported entry (`n` is its 1-based position, for messages) and fills the fields an older
 * entry lacks. Throws on the first problem. An entry written before NPCs could have two bonuses has a single
 * `damageBonus` (or null), read as a one-item list.
 */
export function checkNpc(entry: unknown, n: number): SavedNpc {
  if (!isObject(entry)) throw new Error(`NPC ${n} is not an NPC.`);
  const named = typeof entry['name'] === 'string' ? ` ("${entry['name']}")` : '';
  if (typeof entry['id'] !== 'string' || !entry['id'].trim()) throw new Error(`NPC ${n}${named} has no id.`);
  if (!named) throw new Error(`NPC ${n} has no name.`);
  const fail = (problem: string): never => {
    throw new Error(`NPC ${n}${named}: ${problem}`);
  };

  const text = (field: string) => {
    const value = entry[field] ?? '';
    return typeof value === 'string' ? value : fail(`${field} must be text.`);
  };
  const count = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
  const number = (field: string, label: string, fallback: number) => {
    const value = entry[field] ?? fallback;
    return count(value) ? (value as number) : fail(`${label} must be a whole number of 0 or more.`);
  };
  const list = <T>(value: unknown, label: string, item: (value: unknown) => T | null, problem: (at: number) => string): T[] => {
    if (!Array.isArray(value ?? [])) fail(`${label} must be a list.`);
    return ((value ?? []) as unknown[]).map((v, i) => item(v) ?? fail(problem(i + 1)));
  };

  const wp = entry['wp'] ?? null;
  if (wp !== null && !count(wp)) fail('WP must be a whole number of 0 or more, or null.');

  const legacy = entry['damageBonus'];
  const bonuses = list<DamageBonus>(
    entry['damageBonuses'] ?? (legacy ? [legacy] : []),
    'damage bonuses',
    v => (isObject(v) && DAMAGE_BONUS_ATTRIBUTES.some(a => a === v['attribute']) && DICE.includes(v['dice'] as string)
      ? { attribute: v['attribute'] as string, dice: v['dice'] as string } : null),
    at => `damage bonus ${at} must be STR or AGL with D4 or D6.`,
  );
  bonuses.forEach((b, i) => bonuses.findIndex(o => o.attribute === b.attribute) < i && fail(`damage bonus ${i + 1} repeats ${b.attribute}.`));

  return {
    id: entry['id'],
    name: entry['name'] as string,
    description: text('description'),
    basedOn: text('basedOn'),
    movement: number('movement', 'movement', DEFAULT_MOVEMENT),
    hp: number('hp', 'HP', 0),
    wp: wp as number | null,
    damageBonuses: bonuses,
    skills: list(entry['skills'], 'skills', v => (isObject(v) && typeof v['name'] === 'string' && count(v['level'])
      ? { name: v['name'], level: v['level'] as number } : null), at => `skill ${at} needs a name and a level of 0 or more.`),
    abilities: list(entry['abilities'], 'heroic abilities', v => (isObject(v) && typeof v['name'] === 'string' && count(v['count']) && (v['count'] as number) > 0
      ? { name: v['name'], count: v['count'] as number } : null), at => `heroic ability ${at} needs a name and a count of 1 or more.`),
    gear: list(entry['gear'], 'gear', v => (typeof v === 'string' ? v : null), at => `gear item ${at} must be a name.`),
    spells: list<NpcSpellRef>(entry['spells'], 'spells', v => (isObject(v) && typeof v['name'] === 'string' && typeof v['school'] === 'string' && SPELL_KINDS.includes(v['kind'] as string)
      ? { name: v['name'], school: v['school'], kind: v['kind'] as NpcSpellRef['kind'] } : null),
    at => `spell ${at} needs a name, a school and a kind (Spell, Trick or Recipe).`),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
