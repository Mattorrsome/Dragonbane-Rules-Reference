import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { PickerGroup, PickerItem } from '../hero/picker-groups';
import { BackdropDismiss, toggleDialog } from './dialog';

let nextId = 0;

/**
 * A button that opens a modal list to pick from: a filter box above grouped options on the left, the active option's
 * description on the right. The parent decides what a pick does; the dialog closes when it is accepted.
 */
@Component({
  selector: 'app-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './picker-dialog.html',
  // The wrapper element takes no part in layout: the button sits in the parent's flow.
  host: { style: 'display: contents' },
})
export class PickerDialog {
  readonly buttonLabel = input.required<string>();
  readonly buttonAriaLabel = input<string | null>(null);
  readonly heading = input.required<string>();
  readonly groups = input.required<PickerGroup[]>();
  /** Called with the picked id: null means added (the dialog closes), a string is the message to show. */
  readonly accept = input.required<(id: string) => string | null>();
  /** Offers the filter text itself when nothing matches. */
  readonly custom = input(false);

  /** Makes the element ids unique on the page. */
  protected readonly id = `picker-dialog-${nextId++}`;
  protected readonly filter = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly active = signal(0);
  protected readonly backdrop = new BackdropDismiss();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly shown = computed(() => {
    const text = this.filter().trim().toLowerCase();
    return this.groups()
      .map(g => ({ heading: g.heading, items: g.items.filter(i => i.label.toLowerCase().includes(text)) }))
      .filter(g => g.items.length);
  });

  /** The free-text option, only when nothing matches. */
  protected readonly customItem = computed<PickerItem | null>(() => {
    const text = this.filter().trim();
    return this.custom() && text && !this.shown().length ? { id: text, label: `Add “${text}”`, description: '', added: false } : null;
  });

  /** Every option in display order: the arrow keys step through this. */
  protected readonly options = computed(() => {
    const custom = this.customItem();
    return custom ? [custom] : this.shown().flatMap(g => g.items);
  });

  protected readonly activeItem = computed(() => this.options()[this.active()] ?? null);

  protected optionId(item: PickerItem): string {
    return `${this.id}-option-${this.options().indexOf(item)}`;
  }

  protected open(filterBox: HTMLInputElement): void {
    this.filter.set('');
    this.message.set(null);
    this.active.set(0);
    toggleDialog(this.dialog().nativeElement, true);
    filterBox.focus();
  }

  protected type(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected move(step: number, event: Event): void {
    event.preventDefault();
    this.active.set(Math.max(0, Math.min(this.options().length - 1, this.active() + step)));
    const item = this.activeItem();
    // jsdom has no scrollIntoView.
    if (item) this.dialog().nativeElement.querySelector(`#${this.optionId(item)}`)?.scrollIntoView?.({ block: 'nearest' });
  }

  protected enter(event: Event): void {
    event.preventDefault();
    const item = this.activeItem();
    if (item) this.pick(item);
  }

  protected hover(item: PickerItem): void {
    this.active.set(this.options().indexOf(item));
  }

  protected pick(item: PickerItem): void {
    const message = this.accept()(item.id);
    this.message.set(message);
    if (message === null) toggleDialog(this.dialog().nativeElement, false);
  }
}
