import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardEntry, NpcCard } from '../../npc/npc-card';

/** The book-style NPC box (see NPC_Image_Example.png): the live preview and the image export render this. */
@Component({
  selector: 'app-npc-card',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './npc-card-view.html',
})
export class NpcCardView {
  readonly card = input.required<NpcCard>();

  protected hasDetail(entries: CardEntry[]): boolean {
    return entries.some(e => e.detail);
  }

  protected names(entries: CardEntry[]): string {
    return entries.map(e => e.text).join(', ');
  }
}
