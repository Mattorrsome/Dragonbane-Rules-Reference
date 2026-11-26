import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CharacterCard } from '../../character/character-card';
import { hasDetail } from '../../hero/hero-card';

/** The character card in the NPC card's style: the export preview, and the source of the exported image. */
@Component({
  selector: 'app-character-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './character-card-view.html',
})
export class CharacterCardView {
  readonly card = input.required<CharacterCard>();
  protected readonly hasDetail = hasDetail;
}
