import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Character, CreationReference, derived } from '../../character/character';
import { CurrencyRatesService } from '../../core/currency-rates';
import { abilityEntries, spellEntries } from '../../hero/hero-card';
import { ATTRIBUTES, formatDamageBonus } from '../../hero/hero';
import { formatCoins } from '../../money/coins';

/** The character as it stands, in the NPC card's style: the creator's live preview. */
@Component({
  selector: 'app-character-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './character-summary.html',
})
export class CharacterSummary {
  readonly character = input.required<Character>();
  readonly ref = input.required<CreationReference>();
  /** Whether the attributes are set: until then the rows they fix show a dash, not placeholder scores. */
  readonly rolled = input.required<boolean>();

  private readonly rates = inject(CurrencyRatesService).rates;
  protected readonly attributes = ATTRIBUTES;
  protected readonly derived = computed(() => derived(this.character(), this.ref()));
  protected readonly damageBonus = computed(() => this.derived().damageBonuses.map(formatDamageBonus).join(', '));
  protected readonly skills = computed(() => this.character().skills.filter(s => s.trained).map(s => `${s.name} ${s.level}`).join(', '));
  protected readonly abilities = computed(() =>
    [...this.character().kinAbilities, ...abilityEntries(this.character().abilities, this.ref(), false).map(e => e.text)].join(', '));
  protected readonly spells = computed(() => spellEntries(this.character().spells, this.ref(), false).map(e => e.text).join(', '));
  protected readonly gear = computed(() =>
    this.character().gear.map(g => `${g.quantity > 1 ? `${g.quantity} × ` : ''}${g.name}${g.note ? ` (${g.note})` : ''}`).join(', '));
  protected readonly money = computed(() => {
    const rates = this.rates();
    const copper = this.character().copper;
    return rates ? formatCoins(copper, 'gold', rates) : `${copper} copper`;
  });
}
