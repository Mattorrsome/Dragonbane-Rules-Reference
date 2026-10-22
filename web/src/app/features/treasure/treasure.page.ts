import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-treasure-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="section"><h1 class="chapter-title">Treasure</h1></section>`,
})
export class TreasurePage {}
