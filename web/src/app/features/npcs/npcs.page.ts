import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-npcs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './npcs.page.html',
})
export class NpcsPage {}
