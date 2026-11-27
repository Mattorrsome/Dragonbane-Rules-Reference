import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  AgeDto, AppearanceDto, EquipmentItemDto, HeroicAbilityDto, KinDto, MagicSchoolDto, MementoDto, ProfessionDto, SkillDto,
  SpellDto, WeaknessDto,
} from '../../api/models';
import { Character, CreationReference, SavedCharacter } from '../../character/character';
import { CharacterStore } from '../../character/character.store';
import {
  Creation, CreationStep, MAX_SPELLS, MAX_TRICKS, Step, creationProblems, finishCreation, newCreation,
  professionSkillList, schoolsAvailable, setAge, setAttributes, setHeroicAbility, setKin,
  setProfession, setSchool, skillLimits, spellOptions, stepDone, swapAttributes, toggleSkill, toggleSpell, unchanged,
} from '../../character/creation';
import { randomCharacter, rollStep } from '../../character/random';
import { DiceRoller } from '../../dice/dice-roller';
import { ATTRIBUTES, Attribute, SpellRef, same, sameSpell } from '../../hero/hero';
import { spellLabel } from '../../hero/hero-card';
import { ChipPicker } from '../../shared/chip-picker';
import { BackdropDismiss, toggleDialog } from '../../shared/dialog';
import { download } from '../../shared/file';
import { slug } from '../../shared/text';
import { CharacterEditor } from './character-editor';
import { CharacterSummary } from './character-summary';
import { CharacterExportMenu } from './character-export-menu';
import { CreationGear } from './creation-gear';

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

const valueOf = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value;

/** Guided and random character creation (layout B): the steps on the left, the live summary beside or below them. */
@Component({
  selector: 'app-characters-page',
  imports: [ChipPicker, CharacterEditor, CharacterSummary, CreationGear, CharacterExportMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './characters.page.html',
})
export class CharactersPage {
  private readonly roller = inject(DiceRoller);
  protected readonly store = inject(CharacterStore);
  /** The saved character whose row is asking "Delete …?". */
  protected readonly confirmingDelete = signal<string | null>(null);
  private readonly myHeading = viewChild<ElementRef<HTMLElement>>('myHeading');
  /** What the last Save and the last JSON import did. */
  protected readonly saveStatus = signal('');
  protected readonly importStatus = signal('');
  /** The saved character open in the editor (advancement), in place of the creator. */
  protected readonly editing = signal<SavedCharacter | null>(null);
  private editTrigger?: HTMLElement;
  /** The saved character open in the export menu. */
  protected readonly exporting = signal<SavedCharacter | null>(null);
  private readonly exportDialog = viewChild.required<ElementRef<HTMLDialogElement>>('exportDialog');
  // The dialog follows its signal: open while it holds a character, closed otherwise.
  private readonly syncExportDialog = effect(() => toggleDialog(this.exportDialog().nativeElement, !!this.exporting()));
  protected readonly backdrop = new BackdropDismiss();

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
  protected readonly slug = slug;
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

  protected apply(step: Step): void {
    this.saveStatus.set('');
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
  /** Stores the finished character and starts a fresh one. */
  protected save(): void {
    const saved = this.store.save(this.character());
    this.creation.set(newCreation());
    this.cleared.set([]);
    this.saveStatus.set(`Saved ${saved.name || 'the character'}.`);
    // Save is now disabled (the fresh creator lists what is missing); keep focus in the page, beside the new row.
    this.myHeading()?.nativeElement.focus();
  }

  /** Opens the editor on a saved character; closing it returns focus to this Edit button. */
  protected edit(c: SavedCharacter, event: Event): void {
    this.editTrigger = event.currentTarget as HTMLElement;
    this.editing.set(c);
  }

  /** Replaces the saved character (same id). */
  protected saveEdit(c: SavedCharacter): void {
    const saved = this.store.save(c);
    this.closeEditor();
    this.saveStatus.set(`Saved ${saved.name}.`);
  }

  protected closeEditor(): void {
    this.editing.set(null);
    this.editTrigger?.focus();
  }

  protected remove(c: SavedCharacter): void {
    this.store.remove(c.id);
    if (this.editing()?.id === c.id) this.editing.set(null);
    this.confirmingDelete.set(null);
    // The row and its buttons are gone; keep focus in the section.
    this.myHeading()?.nativeElement.focus();
  }

  protected exportAll(): void {
    download(new Blob([this.store.exportJson()], { type: 'application/json' }), 'characters.json');
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const count = this.store.importJson(await file.text());
      this.importStatus.set(`Imported ${count} character${count === 1 ? '' : 's'}.`);
    } catch (error) {
      // parseCharacterFile names the first problem; a failed file read has no such message.
      const problem = error instanceof Error ? error.message : 'That file could not be read.';
      this.importStatus.set(`${problem} Nothing was imported.`);
    }
    // Choosing the same file again still fires change.
    input.value = '';
  }
}
