import { TestBed } from '@angular/core/testing';
import { addSpell, fromTypical, Npc } from '../../npc/npc';
import { buildCard, cardToMarkdown, cardToText } from '../../npc/npc-card';
import { BANDIT_CHIEF, NPC_REFERENCE as ref } from '../../npc/npc.fixture';
import { CARD_RENDERER, NpcExportMenu } from './npc-export-menu';

const grok = (): Npc =>
  addSpell({ ...fromTypical(BANDIT_CHIEF, ref), name: 'Grok' }, { name: 'DISPEL', school: 'General Magic', kind: 'Spell' });
const png = new Blob(['png'], { type: 'image/png' });
const BLOCKED = 'Your browser blocked the clipboard. Use Download instead.';

describe('NpcExportMenu', () => {
  let rendered: HTMLElement[];
  let clipboard: { writeText: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> } | undefined;
  let downloads: { name: string; type: string; text: Promise<string> }[];

  beforeEach(() => {
    rendered = [];
    downloads = [];
    clipboard = { writeText: vi.fn().mockResolvedValue(undefined), write: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clipboard });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem ??= class {
      constructor(readonly items: Record<string, Blob>) {}
    };
    let lastBlob: Blob;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => ((lastBlob = blob as Blob), 'blob:x'));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, type: lastBlob.type, text: lastBlob.text() });
    });
    TestBed.configureTestingModule({
      imports: [NpcExportMenu],
      providers: [{ provide: CARD_RENDERER, useValue: (node: HTMLElement) => (rendered.push(node), Promise.resolve(png)) }],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function render(npc = grok()) {
    const fixture = TestBed.createComponent(NpcExportMenu);
    fixture.componentRef.setInput('npc', npc);
    fixture.componentRef.setInput('ref', ref);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const click = async (name: string) => {
      [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === name)!.click();
      await fixture.whenStable();
    };
    const status = () => host.querySelector('[role="status"]')?.textContent?.trim() ?? '';
    return { host, click, status };
  }

  it('offers the descriptions checkbox and six actions', async () => {
    const m = await render();

    expect(m.host.querySelector('label[for="export-descriptions"]')?.textContent?.trim()).toBe('Include spell and heroic ability descriptions');
    expect([...m.host.querySelectorAll('button')].map(b => b.textContent?.trim())).toEqual([
      'Copy image', 'Download image', 'Copy text', 'Download text', 'Copy Markdown', 'Download Markdown',
    ]);
    expect(m.host.querySelector('app-npc-card .npc-card')).not.toBeNull();
  });

  it('Copy text puts the card text on the clipboard', async () => {
    const m = await render();

    await m.click('Copy text');

    expect(clipboard!.writeText).toHaveBeenCalledWith(cardToText(buildCard(grok(), ref, false)));
    expect(m.status()).toBe('Copied text.');
  });

  it('the checkbox adds descriptions to what is exported', async () => {
    const m = await render();

    m.host.querySelector<HTMLInputElement>('#export-descriptions')!.click();
    await m.click('Copy Markdown');

    expect(clipboard!.writeText).toHaveBeenCalledWith(cardToMarkdown(buildCard(grok(), ref, true)));
  });

  it('Download Markdown saves grok.md', async () => {
    const m = await render();

    await m.click('Download Markdown');

    expect(downloads.map(d => [d.name, d.type])).toEqual([['grok.md', 'text/markdown']]);
    expect(await downloads[0].text).toBe(cardToMarkdown(buildCard(grok(), ref, false)));
  });

  it('image actions render the card shown', async () => {
    const m = await render();

    await m.click('Download image');
    expect(rendered).toEqual([m.host.querySelector('.npc-card')]);
    expect(downloads.map(d => [d.name, d.type])).toEqual([['grok.png', 'image/png']]);

    await m.click('Copy image');
    expect(clipboard!.write).toHaveBeenCalledTimes(1);
    expect(m.status()).toBe('Copied image.');
  });

  it('says so when the browser has no clipboard, and Download still works', async () => {
    clipboard = undefined;
    const m = await render();

    await m.click('Copy text');
    expect(m.status()).toBe(BLOCKED);
    await m.click('Copy image');
    expect(m.status()).toBe(BLOCKED);

    await m.click('Download text');
    expect(downloads.map(d => d.name)).toEqual(['grok.txt']);
  });

  it('says so when the browser refuses the clipboard', async () => {
    clipboard!.write.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    clipboard!.writeText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const m = await render();

    await m.click('Copy image');
    expect(m.status()).toBe(BLOCKED);
    await m.click('Copy text');
    expect(m.status()).toBe(BLOCKED);
  });
});
