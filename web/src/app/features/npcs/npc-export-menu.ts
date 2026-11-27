import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Npc, NpcReference } from '../../npc/npc';
import { buildCard, cardToMarkdown, cardToText } from '../../npc/npc-card';
import { ExportMenu, rememberedFlag } from '../../shared/export-menu';
import { NpcCardView } from './npc-card-view';

/** Copy or download one NPC as a card image, plain text or Markdown, with or without descriptions and attributes. */
@Component({
  selector: 'app-npc-export-menu',
  imports: [ExportMenu, NpcCardView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './npc-export-menu.html',
})
export class NpcExportMenu {
  readonly npc = input.required<Npc>();
  readonly ref = input.required<NpcReference>();

  protected readonly descriptions = rememberedFlag('dragonbane.npcExport.descriptions');
  protected readonly attributes = rememberedFlag('dragonbane.npcExport.attributes');
  protected readonly card = computed(() => buildCard(this.npc(), this.ref(), this.descriptions.value(), this.attributes.value()));
  protected readonly toText = () => cardToText(this.card());
  protected readonly toMarkdown = () => cardToMarkdown(this.card());
}
