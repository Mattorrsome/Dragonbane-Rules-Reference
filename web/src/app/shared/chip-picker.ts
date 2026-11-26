import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { sentenceCase } from './text';

/** A box with a name list, an Add button and a clear button; the parent decides what Add does with the text. */
@Component({
  selector: 'app-chip-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chip-picker.html',
  // The wrapper element takes no part in layout: the box, list and error sit in the parent's flow as before.
  host: { style: 'display: contents' },
})
export class ChipPicker {
  readonly options = input.required<string[]>();
  readonly noun = input.required<string>();
  /** Makes the box and list ids unique on the page. */
  readonly pickerId = input.required<string>();
  /** Called on Add with the trimmed text: true clears the box, false shows the not-found error. */
  readonly accept = input.required<(text: string) => boolean>();

  protected readonly text = signal('');
  protected readonly failed = signal(false);
  protected readonly sentenceCase = sentenceCase;

  protected type(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  /** Empties the box and keeps focus in it, since the clear button goes away. */
  protected clear(box: HTMLInputElement): void {
    this.text.set('');
    this.failed.set(false);
    box.focus();
  }

  protected add(): void {
    const text = this.text().trim();
    if (!text) return;
    const ok = this.accept()(text);
    this.failed.set(!ok);
    if (ok) this.text.set('');
  }
}
