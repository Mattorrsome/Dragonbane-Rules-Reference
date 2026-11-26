import { parseListFile } from '../shared/list-store';
import { ATTRIBUTES, Attribute } from '../hero/hero';
import { SavedCharacter } from './character';

const SPELL_KINDS = ['Spell', 'Trick', 'Recipe'];
const MAX_SCORE = 18;

/**
 * Reads a character file (an export of My characters). Stops at the first problem and throws an Error whose message
 * says what and where; nothing is returned in that case, so a bad file imports nothing.
 */
export function parseCharacterFile(text: string): SavedCharacter[] {
  return parseListFile(text, checkCharacter, 'character');
}

/**
 * Checks one saved or imported entry (`n` is its 1-based position, for messages) and fills the optional fields it
 * lacks. Throws on the first problem.
 */
export function checkCharacter(entry: unknown, n: number): SavedCharacter {
  if (!isObject(entry)) throw new Error(`Character ${n} is not a character.`);
  const named = typeof entry['name'] === 'string' ? ` ("${entry['name']}")` : '';
  if (typeof entry['id'] !== 'string' || !entry['id'].trim()) throw new Error(`Character ${n}${named} has no id.`);
  if (!named || !(entry['name'] as string).trim()) throw new Error(`Character ${n} has no name.`);
  const fail = (problem: string): never => {
    throw new Error(`Character ${n}${named}: ${problem}`);
  };

  const text = (field: string) => {
    const value = entry[field] ?? '';
    return typeof value === 'string' ? value : fail(`${field} must be text.`);
  };
  const whole = (value: unknown, min: number, max = Infinity) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  const list = <T>(field: string, label: string, item: (value: unknown) => T | null, problem: (at: number) => string): T[] => {
    const value = entry[field] ?? [];
    if (!Array.isArray(value)) fail(`${label} must be a list.`);
    return (value as unknown[]).map((v, i) => item(v) ?? fail(problem(i + 1)));
  };

  const given = isObject(entry['attributes']) ? entry['attributes'] : {};
  const attributes = Object.fromEntries(ATTRIBUTES.map(a =>
    [a, whole(given[a], 1, MAX_SCORE) ? (given[a] as number) : fail(`${a} must be a whole number from 1 to ${MAX_SCORE}.`)])) as Record<Attribute, number>;

  const school = entry['school'] ?? null;
  if (school !== null && typeof school !== 'string') fail('school must be text or null.');
  const copper = entry['copper'] ?? 0;
  if (!whole(copper, 0)) fail('copper must be a whole number of 0 or more.');

  return {
    id: entry['id'],
    name: entry['name'] as string,
    nickname: text('nickname'),
    kin: text('kin'),
    profession: text('profession'),
    school: school as string | null,
    age: text('age'),
    attributes,
    skills: list('skills', 'skills', v => (isObject(v) && typeof v['name'] === 'string' && whole(v['level'], 0, MAX_SCORE)
      ? { name: v['name'], level: v['level'] as number, trained: v['trained'] === true } : null),
    at => `skill ${at} needs a name and a level from 0 to ${MAX_SCORE}.`),
    abilities: list('abilities', 'heroic abilities', v => (isObject(v) && typeof v['name'] === 'string' && whole(v['count'], 1)
      ? { name: v['name'], count: v['count'] as number } : null), at => `heroic ability ${at} needs a name and a count of 1 or more.`),
    kinAbilities: list('kinAbilities', 'kin abilities', v => (typeof v === 'string' ? v : null), at => `kin ability ${at} must be a name.`),
    spells: list('spells', 'spells', v => (isObject(v) && typeof v['name'] === 'string' && typeof v['school'] === 'string' && SPELL_KINDS.includes(v['kind'] as string)
      ? { name: v['name'], school: v['school'], kind: v['kind'] as SavedCharacter['spells'][number]['kind'] } : null),
    at => `spell ${at} needs a name, a school and a kind (Spell, Trick or Recipe).`),
    gear: list('gear', 'gear', v => (isObject(v) && typeof v['name'] === 'string' && whole(v['quantity'], 1) && typeof (v['note'] ?? '') === 'string'
      ? { name: v['name'], quantity: v['quantity'] as number, note: (v['note'] ?? '') as string } : null),
    at => `gear item ${at} needs a name and a quantity of 1 or more.`),
    copper: copper as number,
    weakness: text('weakness'),
    memento: text('memento'),
    appearance: text('appearance'),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
