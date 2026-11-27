import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Character, CreationReference } from '../../character/character';
import { buildCharacterCard, CardRow, CharacterCard } from '../../character/character-card';
import { CurrencyRatesService } from '../../core/currency-rates';
import { CharacterCardView } from './character-card-view';

const DASH = '–';

/** The character as it stands, as the export card shows it: the creator's and the editor's live preview. */
@Component({
  selector: 'app-character-summary',
  imports: [CharacterCardView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-character-card [card]="card()" />',
})
export class CharacterSummary {
  readonly character = input.required<Character>();
  readonly ref = input.required<CreationReference>();
  /** Whether the attributes are set: until then the rows they fix show dashes, not placeholder scores. */
  readonly rolled = input.required<boolean>();

  private readonly rates = inject(CurrencyRatesService).rates;
  /** The card, with what is still to choose shown as a dash: kin, profession and age as rows of their own. */
  protected readonly card = computed((): CharacterCard => {
    const c = this.character();
    const card = buildCharacterCard(c, this.ref(), false, this.rates());
    const school = c.school ? ` (${c.school})` : '';
    const choices: CardRow[] = [
      { label: 'Kin', text: c.kin || DASH },
      { label: 'Profession', text: c.profession ? c.profession + school : DASH },
      { label: 'Age', text: c.age || DASH },
    ];
    const rows = card.rows.map(r =>
      this.rolled() || (r.label !== 'Attributes' && r.label !== 'Ratings') ? r : { ...r, text: r.text.replace(/\d+/g, DASH) });
    return { ...card, identity: '', rows: [...choices, ...rows] };
  });
}
