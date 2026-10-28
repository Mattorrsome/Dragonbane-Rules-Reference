import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { SpellDto } from '../../api/models';
import {
  addGear, addSpell, DAMAGE_BONUS_ATTRIBUTES, isStacking, NEW_WEAPON_SKILL_LEVEL, Npc, NpcReference, NpcSpellRef, removeGear, removeSpell,
  setAbilityCount, setDamageBonus,
} from '../../npc/npc';
import { buildCard } from '../../npc/npc-card';
import { sentenceCase } from '../../shared/text';
import { NpcCardView } from './npc-card-view';

type Picker = 'skill' | 'ability' | 'gear' | 'spell';

/** "Dispel (General Magic)", "Erase (Symbolism, trick)": unique, so a picked label finds its spell. */
export function spellLabel(spell: NpcSpellRef): string {
  const kind = spell.kind === 'Spell' ? '' : `, ${spell.kind.toLowerCase()}`;
  return `${sentenceCase(spell.name)} (${spell.school}${kind})`;
}

/** The whole number in a number box, or null while it is empty or half-typed (mid-edit values change nothing). */
function typedInteger(event: Event): number | null {
  const raw = (event.target as HTMLInputElement).value.trim();
  return /^-?\d+$/.test(raw) ? Number(raw) : null;
}

/** Edits a copy of an NPC with a live card preview; emits the edited NPC on Save. */
@Component({
  selector: 'app-npc-editor',
  imports: [NpcCardView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './npc-editor.html',
})
export class NpcEditor {
  readonly npc = input.required<Npc>();
  readonly ref = input.required<NpcReference>();
  readonly saved = output<Npc>();
  readonly cancelled = output<void>();

  protected readonly draft = linkedSignal(() => ({ ...this.npc() }));
  protected readonly withDescriptions = signal(false);
  protected readonly card = computed(() => buildCard(this.draft(), this.ref(), this.withDescriptions()));
  protected readonly errors = signal<string[]>([]);

  protected readonly toAdd = signal<Record<Picker, string>>({ skill: '', ability: '', gear: '', spell: '' });
  protected readonly pickError = signal<Picker | null>(null);
  protected readonly spellOptions = computed(() =>
    this.ref().spells.map((s: SpellDto) => ({ label: spellLabel(s), spell: { name: s.name, school: s.school, kind: s.kind } })),
  );

  protected readonly isStacking = isStacking;
  protected readonly bonusAttributes = DAMAGE_BONUS_ATTRIBUTES;
  protected readonly spellLabel = spellLabel;

  protected setText(field: 'name' | 'description', event: Event): void {
    this.draft.update(d => ({ ...d, [field]: (event.target as HTMLInputElement).value }));
  }

  /** An empty WP box means no WP; other empty number boxes are caught by Save. */
  protected setNumber(field: 'movement' | 'hp' | 'wp', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.draft.update(d => ({ ...d, [field]: raw === '' && field === 'wp' ? null : raw === '' ? NaN : Number(raw) }));
  }

  /** "None" (an empty value) removes that attribute's bonus. */
  protected setBonus(attribute: string, event: Event): void {
    const dice = (event.target as HTMLSelectElement).value;
    this.draft.update(d => setDamageBonus(d, attribute, dice || null));
  }

  protected bonusDice(npc: Npc, attribute: string): string {
    return npc.damageBonuses.find(b => b.attribute === attribute)?.dice ?? '';
  }

  protected setLevel(name: string, event: Event): void {
    const level = typedInteger(event);
    if (level === null) return;
    this.draft.update(d => ({ ...d, skills: d.skills.map(s => (s.name === name ? { ...s, level } : s)) }));
  }

  /** Removing an ability is the ✕ button's job; an emptied count box keeps the last count. */
  protected setCount(name: string, event: Event): void {
    const count = typedInteger(event);
    if (count === null) return;
    this.draft.update(d => setAbilityCount(d, name, count));
  }

  protected removeSkill(name: string): void {
    this.draft.update(d => ({ ...d, skills: d.skills.filter(s => s.name !== name) }));
  }

  protected removeAbility(name: string): void {
    this.draft.update(d => setAbilityCount(d, name, 0));
  }

  protected removeGear(name: string): void {
    this.draft.update(d => removeGear(d, name));
  }

  protected removeSpell(spell: NpcSpellRef): void {
    this.draft.update(d => removeSpell(d, spell));
  }

  protected typed(picker: Picker, event: Event): void {
    this.toAdd.update(t => ({ ...t, [picker]: (event.target as HTMLInputElement).value }));
  }

  /** Adds what the picker holds; skills, abilities and spells must be Reference names, gear may be anything. */
  protected add(picker: Picker): void {
    const text = this.toAdd()[picker].trim();
    if (!text) return;
    const same = (a: string) => a.toLowerCase() === text.toLowerCase();
    const ref = this.ref();
    let next: Npc | null = null;
    const d = this.draft();
    if (picker === 'gear') next = addGear(d, text, ref);
    if (picker === 'skill') {
      const skill = ref.skills.find(s => same(s.name));
      if (skill) next = d.skills.some(s => s.name === skill.name) ? d : { ...d, skills: [...d.skills, { name: skill.name, level: NEW_WEAPON_SKILL_LEVEL }] };
    }
    if (picker === 'ability') {
      const ability = ref.abilities.find(a => same(a.name));
      if (ability) next = setAbilityCount(d, ability.name, (d.abilities.find(a => a.name === ability.name)?.count ?? 0) + 1);
    }
    if (picker === 'spell') {
      const option = this.spellOptions().find(o => same(o.label));
      if (option) next = addSpell(d, option.spell);
    }
    this.pickError.set(next ? null : picker);
    if (!next) return;
    this.draft.set(next);
    this.toAdd.update(t => ({ ...t, [picker]: '' }));
  }

  protected save(): void {
    const d = this.draft();
    const errors = [
      !d.name.trim() && 'Name is required',
      !(d.movement >= 0) && 'Movement must be 0 or more',
      !(d.hp >= 0) && 'HP must be 0 or more',
      d.wp !== null && !(d.wp >= 0) && 'WP must be 0 or more',
      d.skills.some(s => !(s.level >= 0)) && 'Skill levels must be 0 or more',
    ].filter((e): e is string => !!e);
    this.errors.set(errors);
    if (!errors.length) this.saved.emit({ ...d, name: d.name.trim(), description: d.description.trim() });
  }
}
