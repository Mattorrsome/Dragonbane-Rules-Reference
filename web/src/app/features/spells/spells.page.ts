import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MagicSchoolDto, SpellDto, SpellKind } from '../../api/models';
import { definedOnly } from '../../shared/http';
import { injectQueryParamWriter } from '../../shared/query-params';
import { SearchBox } from '../../shared/search-box';

/** One source sub-table, e.g. "Animism Magic Tricks". */
interface SpellGroup {
  title: string;
  kind: SpellKind;
  spells: SpellDto[];
}

interface SchoolSection {
  school: MagicSchoolDto | undefined;
  name: string;
  groups: SpellGroup[];
}

const KIND_ORDER: readonly SpellKind[] = ['Trick', 'Spell', 'Recipe'];
const KIND_TITLE: Record<SpellKind, string> = { Trick: 'Magic Tricks', Spell: 'Spells', Recipe: 'Recipes' };

@Component({
  selector: 'app-spells-page',
  imports: [SearchBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spells.page.html',
})
export class SpellsPage {
  /** Query params, bound by the router. */
  readonly search = input<string>();
  readonly schoolId = input<string>();
  readonly rank = input<string>();
  readonly kind = input<string>();

  protected readonly ranks = [0, 1, 2, 3, 4, 5, 6];
  protected readonly kinds = KIND_ORDER;
  protected readonly schools = httpResource<MagicSchoolDto[]>(() => '/api/magic-schools');
  protected readonly spells = httpResource<SpellDto[]>(() => ({
    url: '/api/spells',
    params: definedOnly({ search: this.search(), schoolId: this.schoolId(), rank: this.rank(), kind: this.kind() }),
  }));
  protected readonly setFilter = injectQueryParamWriter();

  /** Spells grouped as the source lays them out: by school (API order), then tricks, spells, recipes. */
  protected readonly sections = computed<SchoolSection[]>(() => {
    const schools = this.schools.value() ?? [];
    const bySchool = new Map<number, SpellDto[]>();
    for (const spell of this.spells.value() ?? []) bySchool.set(spell.schoolId, [...(bySchool.get(spell.schoolId) ?? []), spell]);
    return [...bySchool].map(([schoolId, spells]) => {
      const school = schools.find(s => s.id === schoolId);
      const name = school?.name ?? spells[0].school;
      return {
        school,
        name,
        groups: KIND_ORDER.map(kind => ({ kind, title: `${name} ${KIND_TITLE[kind]}`, spells: spells.filter(s => s.kind === kind) }))
          .filter(g => g.spells.length > 0),
      };
    });
  });

  protected onSelect(name: 'schoolId' | 'rank', event: Event): void {
    this.setFilter({ [name]: (event.target as HTMLSelectElement).value || null });
  }
}
