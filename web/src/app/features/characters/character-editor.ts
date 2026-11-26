import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, linkedSignal, output, signal, viewChild,
} from '@angular/core';
import {
  CreationReference, SavedCharacter, setCharacterAbility, setSkillLevel, skillLevel,
} from '../../character/character';
import { CurrencyRatesService } from '../../core/currency-rates';
import { spellLabel } from '../../hero/hero-card';
import { addSpell, ATTRIBUTES, Attribute, findItem, isStacking, removeSpell, same, SpellRef } from '../../hero/hero';
import { Coin, COINS, splitCoins } from '../../money/coins';
import { ChipPicker } from '../../shared/chip-picker';
import { slug } from '../../shared/text';
import { CharacterSummary } from './character-summary';

type TextField = 'name' | 'nickname' | 'weakness' | 'memento' | 'appearance';

const valueOf = (event: Event) => (event.target as HTMLInputElement).value;
/** The number in a box, or NaN while it is empty or half-typed (which changes nothing). */
const numberOf = (event: Event) => (event.target as HTMLInputElement).valueAsNumber;
/** Puts the kept value back in the box when it differs from what was typed: a 19 that was clamped shows 18. */
function show(event: Event, value: number): void {
  const box = event.target as HTMLInputElement;
  if (box.valueAsNumber !== value) box.value = String(value);
}
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(n)));

/**
 * Advancement: edits a copy of a saved character beside its live summary; emits it on Save. Kin, profession, age and
 * school are fixed; nothing is rolled and no prerequisite is enforced.
 */
@Component({
  selector: 'app-character-editor',
  imports: [ChipPicker, CharacterSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './character-editor.html',
})
export class CharacterEditor {
  readonly character = input.required<SavedCharacter>();
  readonly ref = input.required<CreationReference>();
  readonly saved = output<SavedCharacter>();
  readonly cancelled = output<void>();

  private readonly rates = inject(CurrencyRatesService).rates;
  protected readonly draft = linkedSignal(() => ({ ...this.character() }));
  protected readonly errors = signal<string[]>([]);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  protected readonly attributes = ATTRIBUTES;
  protected readonly coins = COINS;
  protected readonly isStacking = isStacking;
  protected readonly spellLabel = spellLabel;
  protected readonly slug = slug;

  /** Every core and weapon skill, then the secondary skills the character knows, at their current levels. */
  protected readonly skills = computed(() => {
    const d = this.draft();
    return this.ref().skills
      .filter(s => s.type !== 'Secondary' || d.skills.some(k => same(k.name, s.name)))
      .map(s => ({ name: s.name, level: skillLevel(d, s) }));
  });
  protected readonly money = computed(() => {
    const rates = this.rates();
    return rates && splitCoins(this.draft().copper, rates);
  });

  protected readonly abilityOptions = computed(() => this.ref().abilities.map(a => a.name));
  protected readonly gearOptions = computed(() => this.ref().equipment.map(i => i.name));
  private readonly spellOptions = computed(() =>
    this.ref().spells.map(s => ({ label: spellLabel(s), spell: { name: s.name, school: s.school, kind: s.kind } as SpellRef })));
  protected readonly spellLabels = computed(() => this.spellOptions().map(o => o.label));

  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  protected setText(field: TextField, event: Event): void {
    this.draft.update(d => ({ ...d, [field]: valueOf(event) }));
  }

  protected setAttribute(attribute: Attribute, event: Event): void {
    const n = numberOf(event);
    if (Number.isNaN(n)) return;
    const score = clamp(n, 1, 18);
    this.draft.update(d => ({ ...d, attributes: { ...d.attributes, [attribute]: score } }));
    show(event, score);
  }

  protected setSkill(name: string, event: Event): void {
    const n = numberOf(event);
    if (Number.isNaN(n)) return;
    this.draft.update(d => setSkillLevel(d, name, n));
    show(event, this.draft().skills.find(s => same(s.name, name))!.level);
  }

  /** The ✕ removes an ability; the count box stays at 1 or more so the chip it sits in stays put. */
  protected setCount(name: string, event: Event): void {
    const n = numberOf(event);
    if (Number.isNaN(n)) return;
    const count = Math.max(1, Math.trunc(n));
    this.draft.update(d => setCharacterAbility(d, name, count));
    show(event, count);
  }

  protected removeAbility(name: string): void {
    this.draft.update(d => setCharacterAbility(d, name, 0));
  }

  /** "Prerequisite: Crafting 12": shown in the chip, not enforced; none for an ability without one ("None"). */
  protected prerequisite(name: string): string | null {
    const ability = this.ref().abilities.find(a => same(a.name, name));
    return ability?.prerequisite && !same(ability.prerequisite, 'None') ? `Prerequisite: ${ability.prerequisite}` : null;
  }

  protected readonly acceptAbility = (text: string): boolean => {
    const ability = this.ref().abilities.find(a => same(a.name, text));
    if (ability) this.draft.update(d => setCharacterAbility(d, ability.name, (d.abilities.find(a => same(a.name, ability.name))?.count ?? 0) + 1));
    return !!ability;
  };

  protected readonly acceptSpell = (text: string): boolean => {
    const option = this.spellOptions().find(o => same(o.label, text));
    if (option) this.draft.update(d => addSpell(d, option.spell));
    return !!option;
  };

  protected removeSpell(spell: SpellRef): void {
    this.draft.update(d => removeSpell(d, spell));
  }

  /** An Equipment item; one already carried goes up by one. */
  protected readonly acceptGear = (text: string): boolean => {
    const item = findItem(this.ref(), text);
    if (!item) return false;
    this.draft.update(d => {
      const at = d.gear.findIndex(g => same(g.name, item.name));
      return at < 0
        ? { ...d, gear: [...d.gear, { name: item.name, quantity: 1, note: '' }] }
        : { ...d, gear: d.gear.map((g, i) => (i === at ? { ...g, quantity: g.quantity + 1 } : g)) };
    });
    return true;
  };

  protected setQuantity(index: number, event: Event): void {
    const n = numberOf(event);
    if (Number.isNaN(n)) return;
    const quantity = Math.max(1, Math.trunc(n));
    this.draft.update(d => ({ ...d, gear: d.gear.map((g, i) => (i === index ? { ...g, quantity } : g)) }));
    show(event, quantity);
  }

  protected setNote(index: number, event: Event): void {
    this.draft.update(d => ({ ...d, gear: d.gear.map((g, i) => (i === index ? { ...g, note: valueOf(event) } : g)) }));
  }

  protected removeGear(index: number): void {
    this.draft.update(d => ({ ...d, gear: d.gear.filter((_, i) => i !== index) }));
  }

  /** The three coin boxes are one amount, stored as copper; an empty box counts as none. */
  protected setCoins(coin: Coin, event: Event): void {
    const rates = this.rates()!;
    const n = numberOf(event);
    const coins = { ...this.money()!, [coin]: Number.isNaN(n) ? 0 : Math.max(0, Math.trunc(n)) };
    this.draft.update(d => ({ ...d, copper: coins.gold * rates.gold + coins.silver * rates.silver + coins.copper * rates.copper }));
    show(event, this.money()![coin]);
  }

  protected save(): void {
    const d = this.draft();
    const errors = d.name.trim() ? [] : ['Name is required'];
    this.errors.set(errors);
    if (!errors.length) this.saved.emit({ ...d, name: d.name.trim() });
  }
}
