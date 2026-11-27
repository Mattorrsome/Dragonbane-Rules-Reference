import { EquipmentCategoryDto, EquipmentItemDto, HeroicAbilityDto, SpellDto } from '../api/models';
import { sentenceCase } from '../shared/text';
import { describeItem, same, SpellRef, sameSpell } from './hero';
import { spellLabel } from './hero-card';

/** One row in the add dialog: `id` is what the caller stores, `added` marks what the hero already has. */
export interface PickerItem { id: string; label: string; description: string; added: boolean }
export interface PickerGroup { heading: string; items: PickerItem[] }

/** One group per school (in first-seen order); tricks first, then by rank, then by name. */
export function spellGroups(spells: readonly SpellDto[], known: readonly SpellRef[]): PickerGroup[] {
  const trick = (s: SpellDto) => (s.kind === 'Trick' ? 0 : 1);
  const schools = [...new Set(spells.map(s => s.school))];
  return schools.map(school => ({
    heading: school,
    items: spells
      .filter(s => s.school === school)
      .sort((a, b) => trick(a) - trick(b) || a.rank - b.rank || a.name.localeCompare(b.name))
      .map(s => ({
        id: spellLabel(s),
        label: `${sentenceCase(s.name)}${s.kind === 'Trick' ? ' (trick)' : s.kind === 'Recipe' ? ' (recipe)' : ` (rank ${s.rank})`}`,
        description: spellDescription(s),
        added: known.some(k => sameSpell(k, s)),
      })),
  }));
}

function spellDescription(s: SpellDto): string {
  const facts = [
    s.castingTime && `Casting time: ${s.castingTime}`,
    s.ranked?.range && `Range: ${s.ranked.range}`,
    s.ranked?.duration && `Duration: ${s.ranked.duration}`,
    s.requirementText && `Requirement: ${s.requirementText}`,
  ].filter(Boolean);
  return [facts.join(' · '), s.description].filter(Boolean).join('\n\n');
}

/** One alphabetical group of heroic abilities. */
export function abilityGroups(abilities: readonly HeroicAbilityDto[], known: readonly string[]): PickerGroup[] {
  const items = [...abilities]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => ({
      id: a.name,
      label: a.name,
      description: `${[same(a.prerequisite, 'None') ? null : `Prerequisite: ${a.prerequisite}`, `WP: ${a.wp}`].filter(Boolean).join(' · ')}\n\n${a.effect}`,
      added: known.some(k => same(k, a.name)),
    }));
  return [{ heading: 'Heroic abilities', items }];
}

/** Cost, weight, stats and effect of one item, on one line. */
export function gearDescription(item: EquipmentItemDto): string {
  const w = item.weapon;
  return [
    `Cost ${item.costText}`,
    item.weight && `Weight ${item.weight}`,
    describeItem(item),
    w?.grip && `Grip ${w.grip}`,
    w && `Range ${w.range}`,
    w?.durability != null && `Durability ${w.durability}`,
  ].filter(Boolean).join(' · ');
}

/** One group per equipment category (in category order), empty ones dropped. */
export function gearGroups(equipment: readonly EquipmentItemDto[], categories: readonly EquipmentCategoryDto[], carried: readonly string[]): PickerGroup[] {
  return categories
    .map(c => ({
      heading: c.name,
      items: equipment
        .filter(i => i.categoryId === c.id)
        .map(i => ({ id: i.name, label: i.name, description: gearDescription(i), added: carried.some(n => same(n, i.name)) })),
    }))
    .filter(g => g.items.length);
}
