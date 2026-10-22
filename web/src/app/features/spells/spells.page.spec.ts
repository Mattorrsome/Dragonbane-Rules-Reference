import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MagicSchoolDto, SpellDto } from '../../api/models';
import { SpellsPage } from './spells.page';

const schools: MagicSchoolDto[] = [
  { id: 1, name: 'General Magic', description: 'Universal magic.', note: null },
  { id: 2, name: 'Animism', description: 'Nature magic.', note: 'Animists commune with nature.' },
];

const trick: SpellDto = {
  id: 1, name: 'Fetch', schoolId: 1, school: 'General Magic', rank: 0, kind: 'Trick', castingTime: 'Action',
  requirementText: 'Gesture', description: 'Make a loose object float to you.', ranked: null, recipe: null,
};
const dispel: SpellDto = {
  id: 2, name: 'DISPEL', schoolId: 1, school: 'General Magic', rank: 1, kind: 'Spell', castingTime: 'Action',
  requirementText: 'Word, gesture', description: 'End a spell.', ranked: { prerequisite: '-', range: '10 metres', duration: 'Instant' }, recipe: null,
};
const heal: SpellDto = {
  id: 3, name: 'HEAL', schoolId: 2, school: 'Animism', rank: 1, kind: 'Spell', castingTime: 'Action',
  requirementText: 'Word, gesture', description: 'Restore HP.', ranked: { prerequisite: '-', range: 'Touch', duration: 'Instant' }, recipe: null,
};

describe('SpellsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SpellsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Renders and lets httpResource send its requests; whenStable() would wait for them to be flushed. */
  async function renderWith(spells: SpellDto[]) {
    const fixture = TestBed.createComponent(SpellsPage);
    TestBed.tick();
    http.expectOne('/api/magic-schools').flush(schools);
    http.expectOne(r => r.url === '/api/spells').flush(spells);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders trick table with Action and Gesture', async () => {
    const host = await renderWith([trick]);

    const headers = [...host.querySelectorAll('table th')].map(th => th.textContent?.trim());
    expect(headers).toEqual(['Name', 'Casting Time', 'Requirement', 'Description']);
    const cells = [...host.querySelectorAll('tbody td')].map(td => td.textContent?.trim());
    expect(cells).toEqual(['Fetch', 'Action', 'Gesture', 'Make a loose object float to you.']);
  });

  it('shows upper-case spell names in sentence case', async () => {
    const host = await renderWith([dispel, { ...heal, name: 'MAGIC SEAL' }]);

    const names = [...host.querySelectorAll('td.row-title')].map(td => td.textContent?.trim());
    expect(names).toEqual(['Dispel', 'Magic seal']);
  });

  it('query params drive request', () => {
    const fixture = TestBed.createComponent(SpellsPage);
    fixture.componentRef.setInput('schoolId', '3');
    fixture.componentRef.setInput('rank', '0');
    TestBed.tick();

    http.expectOne('/api/magic-schools').flush(schools);
    const request = http.expectOne(r => r.url === '/api/spells');
    expect(request.request.params.get('schoolId')).toBe('3');
    expect(request.request.params.get('rank')).toBe('0');
    request.flush([]);
  });

  it('groups by school then kind', async () => {
    const host = await renderWith([trick, dispel, heal]);

    const captions = [...host.querySelectorAll('caption')].map(c => c.textContent?.trim());
    expect(captions).toEqual(['General Magic Magic Tricks', 'General Magic Spells', 'Animism Spells']);
    expect(host.textContent).toContain('Animists commune with nature.');
  });
});
