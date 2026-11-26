import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CARD_RENDERER, ExportMenu, PDF_FAILED } from './export-menu';

@Component({
  imports: [ExportMenu],
  template: `<app-export-menu fileBase="Grok the Bold" fallbackName="npc" [text]="text" [markdown]="markdown" [pdf]="pdf()">
    <div exportOptions>Options here</div>
    <div class="export-card">Card here</div>
  </app-export-menu>`,
})
class Host {
  readonly text = () => 'plain';
  readonly markdown = () => '**md**';
  readonly pdf = signal<(() => Promise<Blob>) | null>(null);
}

describe('ExportMenu', () => {
  let downloads: string[];
  let rendered: HTMLElement[];

  beforeEach(() => {
    downloads = [];
    rendered = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    TestBed.configureTestingModule({
      providers: [{ provide: CARD_RENDERER, useValue: (node: HTMLElement) => (rendered.push(node), Promise.resolve(new Blob(['png']))) }],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function render(pdf: (() => Promise<Blob>) | null = null) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.pdf.set(pdf);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = (name: string) => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);
    const click = async (name: string) => {
      button(name)!.click();
      await fixture.whenStable();
    };
    const formats = () => [...host.querySelectorAll('.export-options button')].map(b => b.textContent?.trim());
    return { host, click, button, formats };
  }

  it('projects the options and the card, and with no pdf Download offers Image, Text and Markdown', async () => {
    const m = await render();

    expect(m.host.textContent).toContain('Options here');
    expect(m.host.textContent).toContain('Card here');
    await m.click('Download');
    expect(m.formats()).toEqual(['Image', 'Text', 'Markdown']);
  });

  it('draws the image from the first .export-card in the projected card', async () => {
    const m = await render();

    await m.click('Download');
    await m.click('Download image');

    expect(rendered).toEqual([m.host.querySelector('.export-card')]);
    expect(downloads).toEqual(['grok-the-bold.png']);
  });

  it('with a pdf maker, Download shows a Download PDF button that saves <fileBase>.pdf; Copy has none', async () => {
    const m = await render(() => Promise.resolve(new Blob(['pdf'])));

    await m.click('Copy');
    expect(m.button('Download PDF')).toBeUndefined();
    await m.click('Download');
    expect(m.formats()).toEqual(['Image', 'Text', 'Markdown', 'PDF']);
    await m.click('Download PDF');

    expect(downloads).toEqual(['grok-the-bold.pdf']);
  });

  it('a pdf maker that rejects shows the failure and downloads nothing', async () => {
    const m = await render(() => Promise.reject(new Error('boom')));

    await m.click('Download');
    await m.click('Download PDF');

    expect(m.host.querySelector('.export-status')?.textContent).toBe(PDF_FAILED);
    expect(downloads).toEqual([]);
  });
});
