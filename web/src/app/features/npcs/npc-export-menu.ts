import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, InjectionToken, input, signal, viewChild } from '@angular/core';
import { toBlob } from 'html-to-image';
import { Npc, NpcReference } from '../../npc/npc';
import { buildCard, cardToMarkdown, cardToText } from '../../npc/npc-card';
import { download, fileName } from '../../npc/npc-export';
import { NpcCardView } from './npc-card-view';

/** Turns the rendered card into a PNG. Injectable so tests need no canvas. */
export const CARD_RENDERER = new InjectionToken<(node: HTMLElement) => Promise<Blob | null>>('CARD_RENDERER', {
  // pixelRatio 2: crisp when pasted into notes or a VTT.
  factory: () => node => toBlob(node, { pixelRatio: 2 }),
});

const BLOCKED = 'Your browser blocked the clipboard. Use Download instead.';
const DESCRIPTIONS_KEY = 'dragonbane.npcExport.descriptions';

function readDescriptions(): boolean {
  try {
    return localStorage.getItem(DESCRIPTIONS_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Copy or download one NPC as a card image, plain text or Markdown, with or without descriptions. */
@Component({
  selector: 'app-npc-export-menu',
  imports: [NpcCardView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './npc-export-menu.html',
})
export class NpcExportMenu {
  readonly npc = input.required<Npc>();
  readonly ref = input.required<NpcReference>();

  private readonly render = inject(CARD_RENDERER);
  protected readonly withDescriptions = signal(readDescriptions());
  protected readonly card = computed(() => buildCard(this.npc(), this.ref(), this.withDescriptions()));
  protected readonly status = signal('');
  private readonly cardHost = viewChild.required<ElementRef<HTMLElement>>('cardHost');

  /** Remembered for the next export, when the browser allows it. */
  protected setDescriptions(on: boolean): void {
    this.withDescriptions.set(on);
    try {
      localStorage.setItem(DESCRIPTIONS_KEY, String(on));
    } catch {
      // Storage blocked: keep the choice for this dialog only.
    }
  }

  protected async copyText(markdown: boolean): Promise<void> {
    const text = markdown ? cardToMarkdown(this.card()) : cardToText(this.card());
    await this.copy(() => navigator.clipboard.writeText(text), markdown ? 'Copied Markdown.' : 'Copied text.');
  }

  protected downloadText(markdown: boolean): void {
    const text = markdown ? cardToMarkdown(this.card()) : cardToText(this.card());
    download(new Blob([text], { type: markdown ? 'text/markdown' : 'text/plain' }), fileName(this.npc().name, markdown ? 'md' : 'txt'));
    this.status.set('');
  }

  protected async copyImage(): Promise<void> {
    // The image is still being drawn when the clipboard is asked, so hand it the promise (Safari requires this).
    const blob = this.image();
    await this.copy(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]), 'Copied image.');
  }

  protected async downloadImage(): Promise<void> {
    download(await this.image(), fileName(this.npc().name, 'png'));
    this.status.set('');
  }

  private async image(): Promise<Blob> {
    const blob = await this.render(this.cardHost().nativeElement.querySelector<HTMLElement>('.npc-card')!);
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
