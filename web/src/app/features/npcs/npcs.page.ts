import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { EquipmentItemDto, HeroicAbilityDto, NpcDto, SkillDto, SpellDto } from '../../api/models';
import { fromTypical, Npc, NpcReference, SavedNpc } from '../../npc/npc';
import { NpcStore } from '../../npc/npc.store';
import { NpcEditor } from './npc-editor';
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
  private readonly spells = httpResource<SpellDto[]>(() => '/api/spells');

  /** Everything NPC names are looked up in; undefined until all of it has loaded. */
  protected readonly ref = computed<NpcReference | undefined>(() => {
    const [skills, abilities, equipment, spells] = [this.skills.value(), this.abilities.value(), this.equipment.value(), this.spells.value()];
    return skills && abilities && equipment && spells ? { skills, abilities, equipment, spells } : undefined;
  });

  /** The NPC open in the editor: a copy of a typical one (no id) or a saved one. */
  protected readonly editing = signal<(Npc & { id?: string }) | null>(null);
  /** The saved NPC whose row is asking "Delete …?". */
  protected readonly confirmingDelete = signal<string | null>(null);
  private readonly myHeading = viewChild<ElementRef<HTMLElement>>('myHeading');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  /** The saved NPC open in the export menu. */
  protected readonly exporting = signal<SavedNpc | null>(null);
  private readonly exportDialog = viewChild.required<ElementRef<HTMLDialogElement>>('exportDialog');

  constructor() {
    // Each dialog follows its signal: open while it holds an NPC, closed otherwise.
    effect(() => toggle(this.dialog().nativeElement, !!this.editing()));
    effect(() => toggle(this.exportDialog().nativeElement, !!this.exporting()));
  }

  protected save(npc: Npc): void {
    this.store.save({ ...npc, id: this.editing()?.id });
    this.editing.set(null);
  }

  protected close(): void {
    this.editing.set(null);
  }

  /**
   * A click on the backdrop lands on the dialog element itself, outside its box: close, as a light dismiss. The
   * dialog's (close) event then clears its signal.
   */
  protected closeOnBackdrop(event: MouseEvent): void {
    const dialog = event.currentTarget as HTMLDialogElement;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  }

  protected tweak(dto: NpcDto): void {
    this.editing.set(fromTypical(dto, this.ref()!));
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
    return dto.heroicAbilities.map(a => ({
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

/** Opens a modal dialog or closes it, whichever it is not already. */
function toggle(dialog: HTMLDialogElement, open: boolean): void {
  if (open && !dialog.open) dialog.showModal();
  if (!open && dialog.open) dialog.close();
}

/** A weapon's or armour's stats first (their effect is often empty), then the item's effect. */
function describeItem(item: EquipmentItemDto): string | null {
  const parts = [
    item.weapon ? `Damage ${item.weapon.damage}, ${item.weapon.featuresText.toLowerCase()}` : null,
    item.armour ? `Armour rating ${item.armour.rating}` : null,
    item.weapon ? null : item.effect,
  ].filter(Boolean);
  return parts.length ? parts.join('. ') : null;
}
