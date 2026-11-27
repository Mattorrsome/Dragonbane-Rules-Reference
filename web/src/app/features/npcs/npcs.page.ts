import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { EquipmentCategoryDto, EquipmentItemDto, HeroicAbilityDto, NpcDto, SkillDto, SpellDto } from '../../api/models';
import { describeItem, stackingLast } from '../../hero/hero';
import { fromTypical, Npc, NpcReference, SavedNpc } from '../../npc/npc';
import { download } from '../../shared/file';
import { NpcStore } from '../../npc/npc.store';
import { NpcEditor } from './npc-editor';
import { BackdropDismiss, toggleDialog } from '../../shared/dialog';
import { NpcExportMenu } from './npc-export-menu';

/** A name in a typical NPC's cell, with its Reference description when it has one. */
interface Described {
  text: string;
  description: string | null;
}

@Component({
  selector: 'app-npcs-page',
  imports: [NgTemplateOutlet, NpcEditor, NpcExportMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './npcs.page.html',
})
export class NpcsPage {
  protected readonly store = inject(NpcStore);

  protected readonly npcs = httpResource<NpcDto[]>(() => '/api/npcs');
  private readonly skills = httpResource<SkillDto[]>(() => '/api/skills');
  private readonly abilities = httpResource<HeroicAbilityDto[]>(() => '/api/heroic-abilities');
  private readonly equipment = httpResource<EquipmentItemDto[]>(() => '/api/equipment');
  private readonly categories = httpResource<EquipmentCategoryDto[]>(() => '/api/equipment-categories');
  private readonly spells = httpResource<SpellDto[]>(() => '/api/spells');

  /** Everything NPC names are looked up in; undefined until all of it has loaded. */
  protected readonly ref = computed<NpcReference | undefined>(() => {
    const [skills, abilities, equipment, categories, spells] = [this.skills.value(), this.abilities.value(), this.equipment.value(), this.categories.value(), this.spells.value()];
    return skills && abilities && equipment && categories && spells ? { skills, abilities, equipment, categories, spells } : undefined;
  });

  /** The NPC open in the editor: a copy of a typical one (no id) or a saved one. */
  protected readonly editing = signal<(Npc & { id?: string }) | null>(null);
  /** The saved NPC whose row is asking "Delete …?". */
  protected readonly confirmingDelete = signal<string | null>(null);
  private readonly myHeading = viewChild<ElementRef<HTMLElement>>('myHeading');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  /** The saved NPC open in the export menu. */
  protected readonly exporting = signal<Npc | null>(null);
  /** What the last JSON import did. */
  protected readonly importStatus = signal('');
  private readonly exportDialog = viewChild.required<ElementRef<HTMLDialogElement>>('exportDialog');

  constructor() {
    // Each dialog follows its signal: open while it holds an NPC, closed otherwise.
    effect(() => toggleDialog(this.dialog().nativeElement, !!this.editing()));
    effect(() => toggleDialog(this.exportDialog().nativeElement, !!this.exporting()));
  }

  protected save(npc: Npc): void {
    this.store.save({ ...npc, id: this.editing()?.id });
    this.editing.set(null);
  }

  protected readonly backdrop = new BackdropDismiss();

  protected close(): void {
    this.editing.set(null);
  }

  protected tweak(dto: NpcDto): void {
    this.editing.set(fromTypical(dto, this.ref()!));
  }

  /** Exports the typical NPC as it is, without saving a copy. */
  protected exportTypical(dto: NpcDto): void {
    this.exporting.set(fromTypical(dto, this.ref()!));
  }

  protected exportAll(): void {
    download(new Blob([this.store.exportJson()], { type: 'application/json' }), 'dragonbane-npcs.json');
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const count = this.store.importJson(await file.text());
      this.importStatus.set(`Imported ${count} NPC${count === 1 ? '' : 's'}.`);
    } catch (error) {
      // parseNpcFile names the first problem; a failed file read has no such message.
      const problem = error instanceof Error ? error.message : 'That file could not be read.';
      this.importStatus.set(`${problem} Nothing was imported.`);
    }
    // Choosing the same file again still fires change.
    input.value = '';
  }

  protected edit(npc: SavedNpc): void {
    this.editing.set(npc);
  }

  protected remove(npc: SavedNpc): void {
    this.store.remove(npc.id);
    this.confirmingDelete.set(null);
    // The row and its buttons are gone; keep focus in the section.
    this.myHeading()?.nativeElement.focus();
  }

  protected skillCells(dto: NpcDto): Described[] {
    return dto.skills.map(s => ({ text: `${s.name} ${s.level}`, description: this.ref()?.skills.find(r => r.name === s.name)?.description ?? null }));
  }

  protected abilityCells(dto: NpcDto): Described[] {
    return stackingLast(dto.heroicAbilities).map(a => ({
      text: a.count > 1 ? `${a.name} ×${a.count}` : a.name,
      description: this.ref()?.abilities.find(r => r.name === a.name)?.effect ?? null,
    }));
  }

  protected gearCells(dto: NpcDto): Described[] {
    return dto.gear.map(name => {
      const item = this.ref()?.equipment.find(i => i.name === name);
      return { text: name, description: item ? describeItem(item) : null };
    });
  }
}
