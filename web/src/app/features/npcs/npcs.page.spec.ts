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
    // jsdom has no modal dialog; the browser behaviour is covered by the e2e test.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
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

  it("lists Robust and Focused at the bottom of each NPC's heroic abilities", async () => {
    const page = await render();
    const archmage = page.table('Typical NPCs').querySelectorAll('tbody tr')[3];

    expect([...archmage.querySelectorAll('[data-label="Heroic abilities"] li')].map(li => li.querySelector('summary')?.textContent?.trim() ?? li.textContent?.trim())).toEqual([
      'Master Spellcaster', 'Robust ×4', 'Focused ×6',
    ]);
  });

  it("shows each description as its name's tooltip", async () => {
    const page = await render();
    const summary = page.table('Typical NPCs').querySelector('summary')!;

    expect(summary.getAttribute('title')).toBe(summary.nextElementSibling?.textContent);
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

  it('Export JSON downloads every saved NPC; it is disabled while there are none', async () => {
    const store = TestBed.inject(NpcStore);
    let saved: { name: string; text: Promise<string> } | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => ((saved = { name: '', text: (blob as Blob).text() }), 'blob:x'));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved!.name = this.download;
    });
    const page = await render();
    expect(page.button('Export JSON').disabled).toBe(true);

    store.save({ ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok' });
    await page.settle();
    page.button('Export JSON').click();

    expect(saved!.name).toBe('dragonbane-npcs.json');
    expect(JSON.parse(await saved!.text)).toEqual(store.npcs());
    vi.restoreAllMocks();
  });

  it('Import JSON adds the NPCs from the chosen file and says how many', async () => {
    const page = await render();
    const file = new File([JSON.stringify([{ ...fromTypical(GUARD, ref), id: 'f1', name: 'From file' }])], 'npcs.json');
    const input = page.host.querySelector<HTMLInputElement>('input[type="file"]')!;
    let picked = false;
    input.addEventListener('click', e => ((picked = true), e.preventDefault()));

    page.button('Import JSON').click();
    expect(picked).toBe(true);
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r));
    await page.settle();

    expect(TestBed.inject(NpcStore).npcs().map(n => n.name)).toEqual(['From file']);
    expect(page.host.querySelector('.import-status')?.textContent?.trim()).toBe('Imported 1 NPC.');
  });

  it.each([
    ['{bad', 'That file is not valid JSON. Nothing was imported.'],
    [JSON.stringify([{ id: 'a', name: 'Grok', hp: 'lots' }]), 'NPC 1 ("Grok"): HP must be a whole number of 0 or more. Nothing was imported.'],
  ])('Import JSON shows the first problem in a bad file and imports nothing', async (text, message) => {
    const page = await render();
    const input = page.host.querySelector<HTMLInputElement>('input[type="file"]')!;

    Object.defineProperty(input, 'files', { configurable: true, value: [new File([text], 'x.json')] });
    input.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r));
    await page.settle();

    expect(page.host.querySelector('.import-status')?.textContent?.trim()).toBe(message);
    expect(TestBed.inject(NpcStore).npcs()).toEqual([]);
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

  describe('dialog', () => {
    const dialog = (host: HTMLElement) => host.querySelector('dialog')!;

    it('Tweak opens a modal dialog on a copy, with the floating Close', async () => {
      const page = await render();

      page.button('Tweak Bandit chief').click();
      await page.settle();

      expect(dialog(page.host).open).toBe(true);
      expect(dialog(page.host).classList).toContain('app-dialog');
      const title = dialog(page.host).querySelector(`#${dialog(page.host).getAttribute('aria-labelledby')}`);
      expect(title?.textContent?.trim()).toBe('Tweak Bandit chief');
      expect(dialog(page.host).querySelector('.dialog-close')?.getAttribute('aria-label')).toBe('Close');
      expect(dialog(page.host).querySelector('app-npc-editor')).not.toBeNull();
    });

    it('saving stores the NPC and closes', async () => {
      const page = await render();
      page.button('Tweak Bandit chief').click();
      await page.settle();

      const name = dialog(page.host).querySelector<HTMLInputElement>('#npc-name')!;
      name.value = 'Grok';
      name.dispatchEvent(new Event('input'));
      await page.settle();
      [...dialog(page.host).querySelectorAll('button')].find(b => b.textContent?.trim() === 'Save')!.click();
      await page.settle();

      expect(TestBed.inject(NpcStore).npcs().map(n => [n.name, n.basedOn])).toEqual([['Grok', 'Bandit chief']]);
      expect(dialog(page.host).open).toBe(false);
      expect(page.table('My NPCs')).toBeTruthy();
    });

    it('Edit opens the saved NPC; saving replaces it', async () => {
      const store = TestBed.inject(NpcStore);
      store.save({ ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok' });
      const page = await render();

      page.button('Edit Grok').click();
      await page.settle();
      const title = dialog(page.host).querySelector(`#${dialog(page.host).getAttribute('aria-labelledby')}`);
      expect(title?.textContent?.trim()).toBe('Edit Grok');
      [...dialog(page.host).querySelectorAll('button')].find(b => b.textContent?.trim() === 'Save')!.click();
      await page.settle();

      expect(store.npcs()).toHaveLength(1);
    });

    it('Close and Cancel close without saving', async () => {
      const page = await render();
      page.button('Tweak Guard').click();
      await page.settle();

      page.button('Close').click();
      await page.settle();
      expect(dialog(page.host).open).toBe(false);

      page.button('Tweak Guard').click();
      await page.settle();
      [...dialog(page.host).querySelectorAll('button')].find(b => b.textContent?.trim() === 'Cancel')!.click();
      await page.settle();
      expect(dialog(page.host).open).toBe(false);
      expect(TestBed.inject(NpcStore).npcs()).toEqual([]);
    });

    it('a drag that starts inside and ends on the backdrop does not close the editor', async () => {
      const page = await render();
      page.button('Tweak Guard').click();
      await page.settle();
      const d = dialog(page.host);
      vi.spyOn(d, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 100));

      // Selecting text in the Name box and releasing outside: the click lands on the dialog itself.
      d.querySelector('#npc-name')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50 }));
      d.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));
      await page.settle();
      expect(d.open).toBe(true);

      // A real backdrop click: pressed and released outside.
      d.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 5, clientY: 5 }));
      d.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));
      await page.settle();
      expect(d.open).toBe(false);
    });
    it('Export opens the export menu for that NPC', async () => {
      const store = TestBed.inject(NpcStore);
      store.save({ ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok' });
      const page = await render();

      page.button('Export Grok').click();
      await page.settle();

      const exportDialog = page.host.querySelector<HTMLDialogElement>('dialog.export-dialog')!;
      expect(exportDialog.open).toBe(true);
      expect(exportDialog.querySelector(`#${exportDialog.getAttribute('aria-labelledby')}`)?.textContent?.trim()).toBe('Export Grok');
      expect(exportDialog.querySelector('app-npc-export-menu .npc-card-name')?.textContent?.trim()).toBe('Grok');
    });

    it('a typical NPC can be exported without tweaking it', async () => {
      const page = await render();

      page.button('Export typical Bandit chief').click();
      await page.settle();

      const exportDialog = page.host.querySelector<HTMLDialogElement>('dialog.export-dialog')!;
      expect(exportDialog.open).toBe(true);
      expect(exportDialog.querySelector('app-npc-export-menu .npc-card-name')?.textContent?.trim()).toBe('Bandit chief');
      expect(TestBed.inject(NpcStore).npcs()).toEqual([]);
    });
  });
});