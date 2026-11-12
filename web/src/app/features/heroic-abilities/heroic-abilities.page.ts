import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { HeroicAbilityDto } from '../../api/models';
import { definedOnly } from '../../shared/http';
import { fadeResource } from '../../shared/fade';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';

@Component({
  selector: 'app-heroic-abilities-page',
  imports: [SearchBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './heroic-abilities.page.html',
})
export class HeroicAbilitiesPage {
  /** Query param, bound by the router. */
  readonly search = input<string>();

  protected readonly abilities = httpResource<HeroicAbilityDto[]>(() => ({
    url: '/api/heroic-abilities',
    params: definedOnly({ search: this.search() }),
  }));
  /** The rows on show: the last results stay up, faded, until the new ones may swap in. */
  protected readonly rows = fadeResource(() => this.abilities);
  protected readonly setFilter = injectQueryParamWriter();
}
