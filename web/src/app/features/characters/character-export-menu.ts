import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Character, CreationReference } from '../../character/character';
import { buildCharacterCard, characterCardToMarkdown, characterCardToText } from '../../character/character-card';
import { CurrencyRatesService } from '../../core/currency-rates';
import { ExportMenu } from '../../shared/export-menu';
import { CharacterCardView } from './character-card-view';

/** Remembered between exports. */
const DESCRIPTIONS_KEY = 'dragonbane.characterExport.descriptions';

function readOption(): boolean {
  try {
    return localStorage.getItem(DESCRIPTIONS_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Copy or download one character as a card image, plain text or Markdown, with or without descriptions. */
@Component({
  selector: 'app-character-export-menu',
  imports: [ExportMenu, CharacterCardView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './character-export-menu.html',
})
export class CharacterExportMenu {
  readonly character = input.required<Character>();
  readonly ref = input.required<CreationReference>();
  /** Task 18 passes the PDF maker; null until then. */
  readonly pdf = input<(() => Promise<Blob>) | null>(null);

  private readonly rates = inject(CurrencyRatesService).rates;
  protected readonly descriptions = signal(readOption());
  protected readonly card = computed(() => buildCharacterCard(this.character(), this.ref(), this.descriptions(), this.rates()));
  protected readonly toText = () => characterCardToText(this.card());
  protected readonly toMarkdown = () => characterCardToMarkdown(this.card());

  protected setDescriptions(on: boolean): void {
    this.descriptions.set(on);
    try {
      localStorage.setItem(DESCRIPTIONS_KEY, String(on));
    } catch {
      // Storage blocked: keep the choice for this dialog only.
    }
  }
}
