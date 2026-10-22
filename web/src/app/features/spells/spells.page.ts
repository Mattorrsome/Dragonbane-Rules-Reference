import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-spells-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="section"><h1 class="chapter-title">Spells</h1></section>`,
})
export class SpellsPage {}
