/** The event hit the dialog element itself at a point outside its box: the backdrop. */
function onBackdrop(event: MouseEvent): boolean {
  const dialog = event.currentTarget as HTMLDialogElement;
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
}

/** Opens a modal dialog or closes it, whichever it is not already. */
export function toggleDialog(dialog: HTMLDialogElement, open: boolean): void {
  if (open && !dialog.open) dialog.showModal();
  if (!open && dialog.open) dialog.close();
}

/**
 * Light dismiss: a click on the backdrop lands on the dialog element itself, outside its box. Both the press and the
 * release must be on the backdrop, so a text selection dragged out of the box keeps the draft. Bind
 * `(mousedown)="backdrop.pressStart($event)"` and `(click)="backdrop.closeOnBackdrop($event)"`; the dialog's
 * (close) event then clears the page's signal.
 */
export class BackdropDismiss {
  private pressed = false;

  pressStart(event: MouseEvent): void {
    this.pressed = onBackdrop(event);
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (this.pressed && onBackdrop(event)) (event.currentTarget as HTMLDialogElement).close();
    this.pressed = false;
  }
}
