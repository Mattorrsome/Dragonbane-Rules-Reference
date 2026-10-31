import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SkillDto, SkillTypeDto } from '../../api/models';
import { SkillsPage } from './skills.page';

const types: SkillTypeDto[] = [
  { id: 1, name: 'Core' },
  { id: 2, name: 'Weapon' },
  { id: 3, name: 'Secondary' },
];

const skills: SkillDto[] = [
  { id: 1, name: 'Acrobatics', type: 'Core', typeId: 1, attribute: 'AGL', attributeNote: null, description: 'Jumping.' },
  { id: 2, name: 'Harmonism', type: 'Secondary', typeId: 3, attribute: 'CHA', attributeNote: 'uses PERFORMANCE', description: 'Music.' },
];

describe('SkillsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SkillsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Renders and lets httpResource send its requests; whenStable() would wait for them to be flushed. */
  function render() {
    const fixture = TestBed.createComponent(SkillsPage);
    TestBed.tick();
    return fixture;
  }

  it('renders the skills table with attribute notes', async () => {
    const fixture = render();
    http.expectOne('/api/skill-types').flush(types);
    http.expectOne(r => r.url === '/api/skills').flush(skills);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('tbody tr').length).toBe(2);
    expect(host.querySelector('caption')?.textContent).toContain('Skills');
    const cells = [...host.querySelectorAll('tbody td')].map(td => td.textContent?.trim());
    expect(cells).toContain('CHA (uses PERFORMANCE)');
  });

  it('requests skills filtered by the typeId input', async () => {
    const fixture = render();
    http.expectOne('/api/skill-types').flush(types);
    http.expectOne(r => r.url === '/api/skills').flush(skills);

    fixture.componentRef.setInput('typeId', '2');
    TestBed.tick();

    const filtered = http.expectOne(r => r.url === '/api/skills' && r.params.get('typeId') === '2');
    expect(filtered.request.params.has('search')).toBe(false);
    filtered.flush([skills[0]]);
  });
});
