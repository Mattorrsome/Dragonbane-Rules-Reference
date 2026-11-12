import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { SkillDto, SkillTypeDto } from '../../api/models';
import { definedOnly } from '../../shared/http';
import { fadeResource } from '../../shared/fade';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';

@Component({
  selector: 'app-skills-page',
  imports: [SearchBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skills.page.html',
})
export class SkillsPage {
  /** Query params, bound by the router. */
  readonly search = input<string>();
  readonly typeId = input<string>();

  protected readonly types = httpResource<SkillTypeDto[]>(() => '/api/skill-types');
  protected readonly skills = httpResource<SkillDto[]>(() => ({
    url: '/api/skills',
    params: definedOnly({ search: this.search(), typeId: this.typeId() }),
  }));
  /** The rows on show: the last results stay up, faded, until the new ones may swap in. */
  protected readonly rows = fadeResource(() => this.skills);
  protected readonly setFilter = injectQueryParamWriter();
}
