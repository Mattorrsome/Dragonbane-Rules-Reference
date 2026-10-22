import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-equipment-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="section"><h1 class="chapter-title">Equipment</h1></section>`,
})
export class EquipmentPage {}
