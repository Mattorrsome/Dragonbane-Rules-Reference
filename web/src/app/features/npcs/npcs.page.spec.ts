import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fromTypical } from '../../npc/npc';
import { ARCHMAGE, BANDIT_CHIEF, GUARD, NPC_REFERENCE as ref, VILLAGER } from '../../npc/npc.fixture';
import { NpcStore } from '../../npc/npc.store';
import { NpcsPage } from './npcs.page';

describe('NpcsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [NpcsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render({ failNpcs = false } = {}) {
    const fixture = TestBed.createComponent(NpcsPage);
    TestBed.tick();
    const npcs = http.expectOne('/api/npcs');
    if (failNpcs) npcs.flush('down', { status: 500, statusText: 'Server Error' });
    else npcs.flush([GUARD, VILLAGER, BANDIT_CHIEF, ARCHMAGE]);
    http.expectOne('/api/skills').flush(ref.skills);
    http.expectOne('/api/heroic-abilities').flush(ref.abilities);
    http.expectOne('/api/equipment').flush(ref.equipment);
    http.expectOne('/api/spells').flush(ref.spells);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const table = (caption: string) =>
      [...host.querySelectorAll('table')].find(t => t.querySelector('caption')?.textContent?.trim() === caption)!;
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!;
    return { fixture, host, table, button, settle: () => fixture.whenStable() };
  }

  it('lists the typical NPCs in source order', async () => {
    const page = await render();
    const typical = page.table('Typical NPCs');

    expect([...typical.querySelectorAll('thead th')].map(th => th.textContent?.trim())).toEqual([
      'Type', 'Skills', 'Heroic abilities', 'Bonus', 'HP', 'WP', 'Typical gear', 'Actions',
    ]);
    expect([...typical.querySelectorAll('tbody tr .row-title')].map(td => td.textContent?.trim())).toEqual([
      'Guard', 'Villager', 'Bandit chief', 'Archmage',
    ]);
    const chief = typical.querySelectorAll('tbody tr')[2];
    expect(chief.querySelector('[data-label="Heroic abilities"]')?.textContent).toContain('Robust ×6');
    expect(chief.querySelector('[data-label="Bonus"]')?.textContent?.trim()).toBe('STR +D6');
    expect(chief.querySelector('[data-label="WP"]')?.textContent?.trim()).toBe('16');
    expect(typical.querySelectorAll('tbody tr')[0].querySelector('[data-label="WP"]')?.textContent?.trim()).toBe('-');
    expect(page.button('Tweak Bandit chief')).toBeTruthy();
  });

  it('opens each name to its Reference description', async () => {
    const page = await render();
    const guard = page.table('Typical NPCs').querySelectorAll('tbody tr')[0];
    const details = (name: string) =>
      [...guard.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent?.trim() === name)!;

    expect(details('Awareness 10').textContent).toContain(ref.skills.find(s => s.name === 'Awareness')!.description);
    expect(details('Broadsword').textContent).toContain('Damage 2D6');
    expect(details('Studded leather').textContent).toContain('Armour rating 2');

    const chief = page.table('Typical NPCs').querySelectorAll('tbody tr')[2];
    const berserker = [...chief.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent?.trim() === 'Berserker')!;
    expect(berserker.textContent).toContain(ref.abilities.find(a => a.name === 'Berserker')!.effect);
  });

  it('shows a name with no Reference row as plain text', async () => {
    const page = await render();
    const archmage = page.table('Typical NPCs').querySelectorAll('tbody tr')[3];

    const skills = archmage.querySelector('[data-label="Skills"]')!;
    expect(skills.textContent).toContain('Magic school 15');
    expect([...skills.querySelectorAll('summary')].map(s => s.textContent?.trim())).toEqual(['Staves 13']);
  });

  it('has an empty My NPCs list at first', async () => {
    const page = await render();

    expect(page.host.textContent).toContain('No saved NPCs yet. Tweak a typical NPC to make one.');
    expect(page.table('My NPCs')).toBeUndefined();
  });

  it('lists saved NPCs with Edit and Delete', async () => {
    const store = TestBed.inject(NpcStore);
    store.save({ ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok' });
    store.save({ ...fromTypical(GUARD, ref), name: 'Sergeant Pell' });
    const page = await render();
    const mine = page.table('My NPCs');

    expect([...mine.querySelectorAll('thead th')].map(th => th.textContent?.trim())).toEqual(['Name', 'Based on', 'Actions']);
    expect([...mine.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].slice(0, 2).map(td => td.textContent?.trim()))).toEqual([
      ['Grok', 'Bandit chief'], ['Sergeant Pell', 'Guard'],
    ]);
    expect(page.button('Edit Grok')).toBeTruthy();
    expect(page.button('Delete Grok')).toBeTruthy();
  });

  it('confirms a delete in the row', async () => {
    const store = TestBed.inject(NpcStore);
    store.save({ ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok' });
    const page = await render();

    page.button('Delete Grok').click();
    await page.settle();
    expect(page.table('My NPCs').textContent).toContain('Delete Grok?');
    page.button('Keep').click();
    await page.settle();
    expect(page.button('Delete Grok')).toBeTruthy();
    expect(store.npcs()).toHaveLength(1);

    page.button('Delete Grok').click();
    await page.settle();
    page.button('Yes, delete').click();
    await page.settle();
    expect(store.npcs()).toHaveLength(0);
    expect(document.activeElement).toBe(page.host.querySelector('#my-npcs-heading'));
  });

  it('Tweak and Edit open the NPC for editing', async () => {
    const store = TestBed.inject(NpcStore);
    const grok = store.save({ ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok' });
    const page = await render();
    const editing = () => (page.fixture.componentInstance as unknown as { editing(): { name: string; id?: string } | null }).editing();

    page.button('Tweak Guard').click();
    expect(editing()).toMatchObject({ name: 'Guard', basedOn: 'Guard' });
    expect(editing()?.id).toBeUndefined();

    page.button('Edit Grok').click();
    expect(editing()).toEqual(grok);
  });

  it('says so when the NPC table cannot load', async () => {
    const page = await render({ failNpcs: true });

    expect(page.host.querySelector('[role="alert"]')?.textContent?.trim()).toBe('The NPC table could not be loaded. Is the API running?');
  });
});
