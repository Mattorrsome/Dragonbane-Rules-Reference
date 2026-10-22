import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-heroic-abilities-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="section"><h1 class="chapter-title">Heroic Abilities</h1></section>`,
})
export class HeroicAbilitiesPage {}
