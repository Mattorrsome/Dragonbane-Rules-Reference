import { ChangeDetectionStrategy, Component, OnDestroy, input, model } from '@angular/core';

let nextId = 0;

/** Labelled search field; `value` updates 250 ms after typing stops. */
@Component({
  selector: 'app-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label [for]="id">{{ label() }}</label>
    <input type="search" [id]="id" [value]="value()" (input)="onInput($event)" autocomplete="off" />
  `,
  host: { class: 'search-box' },
})
export class SearchBox implements OnDestroy {
  readonly label = input.required<string>();
  readonly value = model<string>('');
  protected readonly id = `search-${nextId++}`;
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    clearTimeout(this.timer);
    // Untrimmed: the value is written back to the input, so trimming here would eat a space typed before a pause.
    this.timer = setTimeout(() => this.value.set(text), 250);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
