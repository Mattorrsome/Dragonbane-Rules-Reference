import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { GearPackageDto, MagicSchoolDto, ProfessionDto } from '../../api/models';
import { CreationReference } from '../../character/character';
import {
  Creation, DOSES, Step, chooseGearPackage, doseName, enchantNote, setAlchemistDoses, setEnchantment, unchanged,
} from '../../character/creation';
import { DiceRoller } from '../../dice/dice-roller';
import { same } from '../../hero/hero';

const valueOf = (event: Event) => (event.target as HTMLSelectElement).value;

/** The creator's Gear step: the package, the choices inside it, an alchemist's doses and an enchanter's item. */
@Component({
  selector: 'app-creation-gear',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './creation-gear.html',
  // Its fields sit in the step body's flow, as they did before it was its own component.
  host: { style: 'display: contents' },
})
export class CreationGear {
  private readonly roller = inject(DiceRoller);
  readonly creation = input.required<Creation>();
  readonly ref = input.required<CreationReference>();
  readonly profession = input.required<ProfessionDto | undefined>();
  readonly school = input.required<MagicSchoolDto | undefined>();
  readonly changed = output<Step>();

  /** The chosen package with the school extras after it, as `packageChoices` indexes them. */
  protected readonly packageEntries = computed(() => {
    const c = this.creation();
    const pkg = this.profession()?.gearPackages.find(p => p.rollFrom === c.gearPackage);
    return pkg ? [...pkg.entries, ...(this.school()?.extras.flatMap(x => x.entries) ?? [])] : [];
  });
  protected readonly recipes = computed(() => this.creation().character.spells.filter(s => s.kind === 'Recipe').map(s => s.name));
  /** The three dose boxes: the doses held, else what has been chosen so far. Reset only when the gear changes. */
  protected readonly doses = linkedSignal({
    source: () => this.creation().character.gear,
    computation: gear => {
      const held = gear.flatMap(g => this.recipes().filter(r => g.name === doseName(r)));
      return held.length === DOSES ? held : Array<string>(DOSES).fill('');
    },
  });
  protected readonly enchantingSpells = computed(() =>
    this.creation().character.spells.filter(s => s.kind === 'Spell' && same(s.school, 'Enchanting')).map(s => s.name));
  /** The enchanted item (index, -1 for none) and its spell, from the gear's note. Reset only when the gear changes. */
  protected readonly enchantment = linkedSignal({
    source: () => this.creation().character.gear,
    computation: gear => {
      const item = gear.findIndex(g => this.enchantingSpells().some(s => g.note === enchantNote(s)));
      return { item, spell: item < 0 ? '' : this.enchantingSpells().find(s => gear[item].note === enchantNote(s))! };
    },
  });

  /** "1–2: Broadsword, Battleaxe or Morningstar, …" (rations and silver are rolled, so left out). */
  protected packageLabel(pkg: GearPackageDto): string {
    return `${pkg.rollFrom}–${pkg.rollTo}: ${pkg.entries.filter(e => e.kind === 'Item').map(e => e.options.join(' or ')).join(', ')}`;
  }

  protected choosePackage(event: Event): void {
    const pkg = this.profession()?.gearPackages.find(p => String(p.rollFrom) === valueOf(event));
    if (pkg) this.changed.emit(chooseGearPackage(this.creation(), pkg, this.ref(), this.roller));
  }

  /** A choice inside the held package: only that item changes. */
  protected chooseOption(entry: number, event: Event): void {
    const c = this.creation();
    const pkg = this.profession()?.gearPackages.find(p => p.rollFrom === c.gearPackage);
    if (pkg) this.changed.emit(chooseGearPackage(c, pkg, this.ref(), this.roller, { ...c.packageChoices, [entry]: Number(valueOf(event)) }));
  }

  protected chooseDose(index: number, event: Event): void {
    const doses = this.doses().map((d, i) => (i === index ? valueOf(event) : d));
    this.doses.set(doses);
    if (doses.every(Boolean)) this.changed.emit(unchanged(setAlchemistDoses(this.creation(), doses)));
  }

  /** One item bears a known enchanting spell plus PERMANENCE; choosing another moves the note. */
  protected enchant(part: 'item' | 'spell', event: Event): void {
    const value = valueOf(event);
    const next = { ...this.enchantment(), [part]: part === 'item' ? Number(value) : value };
    this.enchantment.set(next);
    this.changed.emit(unchanged(setEnchantment(this.creation(), next.item, next.spell)));
  }
}
