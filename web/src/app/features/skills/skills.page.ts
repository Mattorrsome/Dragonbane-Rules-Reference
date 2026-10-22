import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-skills-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="section"><h1 class="chapter-title">Skills</h1></section>`,
})
export class SkillsPage {}
