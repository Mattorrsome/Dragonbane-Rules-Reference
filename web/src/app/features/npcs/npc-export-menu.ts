import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Npc, NpcReference } from '../../npc/npc';
import { buildCard, cardToMarkdown, cardToText } from '../../npc/npc-card';
import { ExportMenu } from '../../shared/export-menu';
import { NpcCardView } from './npc-card-view';

/** The export options remembered between exports, by localStorage key. */
const OPTION_KEYS = { descriptions: 'dragonbane.npcExport.descriptions', attributes: 'dragonbane.npcExport.attributes' };
type ExportOption = keyof typeof OPTION_KEYS;

function readOption(option: ExportOption): boolean {
  try {
    return localStorage.getItem(OPTION_KEYS[option]) === 'true';
  } catch {
    return false;
  }
}

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

  protected readonly options = signal<Record<ExportOption, boolean>>({ descriptions: readOption('descriptions'), attributes: readOption('attributes') });
  protected readonly card = computed(() => buildCard(this.npc(), this.ref(), this.options().descriptions, this.options().attributes));
  protected readonly toText = () => cardToText(this.card());
  protected readonly toMarkdown = () => cardToMarkdown(this.card());

  /** Remembered for the next export, when the browser allows it. */
  protected setOption(option: ExportOption, on: boolean): void {
    this.options.update(o => ({ ...o, [option]: on }));
    try {
      localStorage.setItem(OPTION_KEYS[option], String(on));
    } catch {
      // Storage blocked: keep the choice for this dialog only.
    }
  }
}
