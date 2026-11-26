import { ChangeDetectionStrategy, Component, ElementRef, inject, InjectionToken, input, signal, viewChild } from '@angular/core';
import { toBlob } from 'html-to-image';
import { download, fileName } from './file';

/** Turns the rendered card into a PNG. Injectable so tests need no canvas. */
export const CARD_RENDERER = new InjectionToken<(node: HTMLElement) => Promise<Blob | null>>('CARD_RENDERER', {
  // pixelRatio 2: crisp when pasted into notes or a VTT.
  factory: () => node => toBlob(node, { pixelRatio: 2 }),
});

export const PDF_FAILED = 'The PDF could not be made.';
const BLOCKED = 'Your browser blocked the clipboard. Use Download instead.';

/**
 * Copy or download something as a card image, plain text or Markdown (and a PDF when given a maker).
 * Project the option checkboxes as `[exportOptions]` and the card (its root has class `export-card`) as the content.
 */
@Component({
  selector: 'app-export-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-menu.html',
})
export class ExportMenu {
  /** File names are made from this, falling back to `fallbackName` when it has no letters or digits. */
  readonly fileBase = input.required<string>();
  readonly fallbackName = input.required<string>();
  readonly text = input.required<() => string>();
  readonly markdown = input.required<() => string>();
  readonly pdf = input<(() => Promise<Blob>) | null>(null);

  private readonly render = inject(CARD_RENDERER);
  protected readonly status = signal('');
  protected readonly modes = ['copy', 'download'] as const;
  /** Whose formats are showing: Copy's, Download's, or neither. */
  protected readonly mode = signal<'copy' | 'download' | null>(null);
  private readonly cardHost = viewChild.required<ElementRef<HTMLElement>>('cardHost');

  /** Shows that button's formats in place of the other's; the open one's button closes them. */
  protected toggle(mode: 'copy' | 'download'): void {
    this.mode.update(m => (m === mode ? null : mode));
  }

  private name(ext: 'png' | 'txt' | 'md' | 'pdf'): string {
    return fileName(this.fileBase(), ext, this.fallbackName());
  }

  protected async copyText(markdown: boolean): Promise<void> {
    const text = markdown ? this.markdown()() : this.text()();
    await this.copy(() => navigator.clipboard.writeText(text), markdown ? 'Copied Markdown.' : 'Copied text.');
  }

  protected downloadText(markdown: boolean): void {
    const text = markdown ? this.markdown()() : this.text()();
    download(new Blob([text], { type: markdown ? 'text/markdown' : 'text/plain' }), this.name(markdown ? 'md' : 'txt'));
    this.status.set('');
  }

  protected async copyImage(): Promise<void> {
    // The image is still being drawn when the clipboard is asked, so hand it the promise (Safari requires this).
    const blob = this.image();
    await this.copy(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]), 'Copied image.');
  }

  protected async downloadImage(): Promise<void> {
    download(await this.image(), this.name('png'));
    this.status.set('');
  }

  protected async downloadPdf(): Promise<void> {
    try {
      download(await this.pdf()!(), this.name('pdf'));
      this.status.set('');
    } catch {
      this.status.set(PDF_FAILED);
    }
  }

  private async image(): Promise<Blob> {
    const blob = await this.render(this.cardHost().nativeElement.querySelector<HTMLElement>('.export-card')!);
    if (!blob) throw new Error('The card could not be drawn.');
    return blob;
  }

  /** Runs a clipboard write; a missing clipboard or a refusal becomes the "use Download" message. */
  private async copy(write: () => Promise<void>, done: string): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error('No clipboard');
      await write();
      this.status.set(done);
    } catch {
      this.status.set(BLOCKED);
    }
  }
}
