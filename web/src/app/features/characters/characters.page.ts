import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  AgeDto, AppearanceDto, EquipmentItemDto, GearPackageDto, HeroicAbilityDto, KinDto, MagicSchoolDto, MementoDto, ProfessionDto, SkillDto,
  SpellDto, WeaknessDto,
} from '../../api/models';
import { Character, CreationReference } from '../../character/character';
import {
  Creation, CreationStep, DOSES, MAX_SPELLS, MAX_TRICKS, Step, chooseGearPackage, creationProblems, finishCreation, newCreation,
  professionSkillList, schoolsAvailable, setAge, setAlchemistDoses, setAttributes, setHeroicAbility, setItemNote, setKin,
  setProfession, setSchool, skillLimits, spellOptions, stepDone, swapAttributes, toggleSkill, toggleSpell, unchanged,
} from '../../character/creation';
import { randomCharacter, rollStep } from '../../character/random';
import { DiceRoller } from '../../dice/dice-roller';
import { ATTRIBUTES, Attribute, SpellRef, same, sameSpell } from '../../hero/hero';
import { ChipPicker } from '../../shared/chip-picker';
import { spellLabel } from '../npcs/npc-editor';
import { CharacterSummary } from './character-summary';

/** The creation steps in book order (Random rolls magic before skills; see random.ts). */
const STEPS: { step: CreationStep; label: string }[] = [
  { step: 'kin', label: 'Kin' },
  { step: 'profession', label: 'Profession' },
  { step: 'age', label: 'Age' },
  { step: 'name', label: 'Name' },
  { step: 'attributes', label: 'Attributes' },
  { step: 'skills', label: 'Skills' },
  { step: 'magic', label: 'Heroic ability or magic' },
  { step: 'weakness', label: 'Weakness' },
  { step: 'memento', label: 'Memento' },
  { step: 'gear', label: 'Gear' },
  { step: 'appearance', label: 'Appearance' },
];

type TextField = 'name' | 'nickname' | 'weakness' | 'memento' | 'appearance';

const doseName = (recipe: string) => `${recipe}, dose`;
const enchantNote = (spell: string) => `Enchanted: ${spell} + PERMANENCE`;
const valueOf = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value;

/** Guided and random character creation (layout B): the steps on the left, the live summary beside or below them. */
@Component({
  selector: 'app-characters-page',
  imports: [ChipPicker, CharacterSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './characters.page.html',
})
export class CharactersPage {
  private readonly roller = inject(DiceRoller);

  private readonly resources = {
    skills: httpResource<SkillDto[]>(() => '/api/skills'),
    abilities: httpResource<HeroicAbilityDto[]>(() => '/api/heroic-abilities'),
    equipment: httpResource<EquipmentItemDto[]>(() => '/api/equipment'),
    spells: httpResource<SpellDto[]>(() => '/api/spells'),
    kin: httpResource<KinDto[]>(() => '/api/kin'),
    professions: httpResource<ProfessionDto[]>(() => '/api/professions'),
    ages: httpResource<AgeDto[]>(() => '/api/ages'),
    schools: httpResource<MagicSchoolDto[]>(() => '/api/magic-schools'),
    mementos: httpResource<MementoDto[]>(() => '/api/mementos'),
    weaknesses: httpResource<WeaknessDto[]>(() => '/api/weaknesses'),
    appearances: httpResource<AppearanceDto[]>(() => '/api/appearances'),
  };
  protected readonly loadFailed = computed(() => Object.values(this.resources).some(r => r.error()));
  /** Everything creation looks up; undefined until all of it has loaded. */
  protected readonly ref = computed<CreationReference | undefined>(() => {
    const entries = Object.entries(this.resources).map(([key, r]) => [key, r.value()] as const);
    return entries.every(([, value]) => value) ? (Object.fromEntries(entries) as unknown as CreationReference) : undefined;
  });

  protected readonly steps = STEPS;
  protected readonly attributes = ATTRIBUTES;
  protected readonly spellLabel = spellLabel;
  protected readonly creation = signal<Creation>(newCreation());
  /** What the last change removed, for the polite live region. */
  protected readonly cleared = signal<string[]>([]);

  /** The character as it would be saved: picked skills trained at twice their base chance. */
  protected readonly character = computed<Character>(() => {
    const ref = this.ref();
    return ref ? finishCreation(this.creation(), ref) : this.creation().character;
  });
  protected readonly problems = computed(() => {
    const ref = this.ref();
    return ref ? creationProblems(this.creation(), ref) : [];
  });

  protected readonly kin = computed(() => this.ref()?.kin.find(k => same(k.name, this.creation().character.kin)));
  protected readonly profession = computed(() => this.ref()?.professions.find(p => same(p.name, this.creation().character.profession)));
  protected readonly age = computed(() => this.ref()?.ages.find(a => same(a.name, this.creation().character.age)));
  protected readonly school = computed(() => {
    const name = this.creation().character.school;
    return name === null ? undefined : this.ref()?.schools.find(s => same(s.name, name));
  });
  /** A mage takes its skill list from its school, so it chooses magic before skills. */
  protected readonly needsSchool = computed(() => !!this.profession() && !this.profession()!.skills.length && !this.school());

  protected readonly limits = computed(() => skillLimits(this.creation(), this.ref()!));
  protected readonly professionList = computed(() => professionSkillList(this.creation(), this.ref()!));
  /** Core skills not yet picked: the free picks. */
  protected readonly freeOptions = computed(() => {
    const c = this.creation();
    const picked = [...c.professionSkills, ...c.freeSkills];
    return this.ref()!.skills.filter(s => s.type !== 'Secondary' && !picked.some(p => same(p, s.name))).map(s => s.name);
  });
  protected readonly acceptFree = (text: string): boolean => {
    const skill = this.ref()!.skills.find(s => same(s.name, text));
    if (!skill) return false;
    const c = this.creation();
    if ([...c.professionSkills, ...c.freeSkills].some(p => same(p, skill.name))) return true;
    const next = toggleSkill(c, skill.name, this.ref()!);
    this.update(next);
    return next !== c;
  };

  protected readonly schools = computed(() => schoolsAvailable(this.creation(), this.ref()!));
  protected readonly counts = computed(() => {
    const spells = this.creation().character.spells;
    return { spells: spells.filter(s => s.kind !== 'Trick').length, tricks: spells.filter(s => s.kind === 'Trick').length };
  });
  protected readonly maxSpells = MAX_SPELLS;
  protected readonly maxTricks = MAX_TRICKS;
  /** Spell options still open: not known, and their kind (spell or trick) not yet full. */
  protected readonly spellChoices = computed(() => {
    const { spells, tricks } = this.counts();
    const known = this.creation().character.spells;
    return spellOptions(this.creation(), this.ref()!)
      .filter(o => !known.some(k => sameSpell(k, o)) && (o.kind === 'Trick' ? tricks < MAX_TRICKS : spells < MAX_SPELLS))
      .map(o => ({ label: spellLabel(o), spell: { name: o.name, school: o.school, kind: o.kind } as SpellRef }));
  });
  protected readonly spellLabels = computed(() => this.spellChoices().map(o => o.label));
  protected readonly acceptSpell = (text: string): boolean => {
    const choice = this.spellChoices().find(o => same(o.label, text));
    if (choice) this.update(toggleSpell(this.creation(), choice.spell, this.ref()!));
    return !!choice;
  };

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

  /** The six boxes: the rolled or entered scores, or what has been typed so far. */
  protected readonly typed = linkedSignal<Record<Attribute, number> | null, Partial<Record<Attribute, number>>>({
    source: () => this.creation().rolledAttributes,
    computation: rolled => ({ ...rolled }),
  });
  protected readonly swapPair = signal<[Attribute, Attribute]>(['STR', 'CON']);

  /** The ticks: from the same tagged problems Save lists. */
  protected readonly done = computed(() => stepDone(this.creation(), this.ref()!));

  /** "4 free skills. STR -2, AGL -2." */
  protected ageNote(age: AgeDto): string {
    const adjustments = age.adjustments.map(a => `${a.attribute} ${a.delta > 0 ? '+' : ''}${a.delta}`).join(', ');
    return `${age.freeSkills} free skills.${adjustments ? ` ${adjustments}.` : ''}`;
  }

  /** "1–2: Broadsword, Battleaxe or Morningstar, …" (rations and silver are rolled, so left out). */
  protected packageLabel(pkg: GearPackageDto): string {
    return `${pkg.rollFrom}–${pkg.rollTo}: ${pkg.entries.filter(e => e.kind === 'Item').map(e => e.options.join(' or ')).join(', ')}`;
  }

  private apply(step: Step): void {
    this.creation.set(step.creation);
    this.cleared.set(step.cleared);
  }

  private update(c: Creation): void {
    this.apply(unchanged(c));
  }

  protected roll(step: CreationStep): void {
    this.apply(rollStep(this.creation(), step, this.ref()!, this.roller));
  }

  protected random(): void {
    this.update(randomCharacter(this.ref()!, this.roller));
  }

  protected chooseKin(event: Event): void {
    const kin = this.ref()!.kin.find(k => k.name === valueOf(event));
    if (kin) this.update(setKin(this.creation(), kin));
  }

  protected chooseProfession(event: Event): void {
    const profession = this.ref()!.professions.find(p => p.name === valueOf(event));
    if (profession) this.apply(setProfession(this.creation(), profession, this.ref()!));
  }

  protected chooseAge(event: Event): void {
    const age = this.ref()!.ages.find(a => a.name === valueOf(event));
    if (age) this.apply(setAge(this.creation(), age, this.ref()!));
  }

  protected setText(field: TextField, event: Event): void {
    const c = this.creation();
    this.update({ ...c, character: { ...c.character, [field]: valueOf(event) } });
  }

  /** Once all six boxes hold a number, they become the attributes (kept within 3-18). */
  protected enterAttribute(attribute: Attribute, event: Event): void {
    const raw = valueOf(event).trim();
    const scores = { ...this.typed(), [attribute]: raw === '' ? undefined : Number(raw) };
    this.typed.set(scores);
    if (ATTRIBUTES.every(a => Number.isFinite(scores[a]))) {
      this.apply(setAttributes(this.creation(), scores as Record<Attribute, number>, this.ref()!));
    }
  }

  protected chooseSwap(which: 0 | 1, event: Event): void {
    this.swapPair.update(pair => (which ? [pair[0], valueOf(event) as Attribute] : [valueOf(event) as Attribute, pair[1]]));
  }

  protected swap(): void {
    const [a, b] = this.swapPair();
    this.apply(swapAttributes(this.creation(), a, b, this.ref()!));
  }

  protected isPicked(skill: string): boolean {
    const c = this.creation();
    return [...c.professionSkills, ...c.freeSkills].some(s => same(s, skill));
  }

  /** Picked skills untrain; others train only while there is room (the picker blocks over-picking). */
  protected canToggle(skill: string): boolean {
    return toggleSkill(this.creation(), skill, this.ref()!) !== this.creation();
  }

  protected toggleSkill(skill: string): void {
    this.update(toggleSkill(this.creation(), skill, this.ref()!));
  }

  protected chooseSchool(event: Event): void {
    const name = valueOf(event);
    const school = this.ref()!.schools.find(s => s.name === name) ?? null;
    this.apply(setSchool(this.creation(), school, this.ref()!));
  }

  protected chooseAbility(event: Event): void {
    this.update(setHeroicAbility(this.creation(), valueOf(event)));
  }

  protected removeSpell(spell: SpellRef): void {
    this.update(toggleSpell(this.creation(), spell, this.ref()!));
  }

  protected choosePackage(event: Event): void {
    const pkg = this.profession()?.gearPackages.find(p => String(p.rollFrom) === valueOf(event));
    if (pkg) this.apply(chooseGearPackage(this.creation(), pkg, this.ref()!, this.roller));
  }

  /** A choice inside the held package: only that item changes. */
  protected chooseOption(entry: number, event: Event): void {
    const c = this.creation();
    const pkg = this.profession()?.gearPackages.find(p => p.rollFrom === c.gearPackage);
    if (pkg) this.apply(chooseGearPackage(c, pkg, this.ref()!, this.roller, { ...c.packageChoices, [entry]: Number(valueOf(event)) }));
  }

  protected chooseDose(index: number, event: Event): void {
    const doses = this.doses().map((d, i) => (i === index ? valueOf(event) : d));
    this.doses.set(doses);
    if (doses.every(Boolean)) this.update(setAlchemistDoses(this.creation(), doses));
  }

  /** One item bears a known enchanting spell plus PERMANENCE; choosing another moves the note. */
  protected enchant(part: 'item' | 'spell', event: Event): void {
    const value = valueOf(event);
    const next = { ...this.enchantment(), [part]: part === 'item' ? Number(value) : value };
    this.enchantment.set(next);
    let c = this.creation();
    c.character.gear.forEach((g, i) => { if (g.note.startsWith('Enchanted: ')) c = setItemNote(c, i, ''); });
    if (next.item >= 0 && next.spell) c = setItemNote(c, next.item, enchantNote(next.spell));
    this.update(c);
  }
}
