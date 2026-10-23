import { Injectable, signal } from '@angular/core';
import { CoinStandard } from '../api/models';

const KEY = 'dragonbane.coinStandard';
const STANDARDS: readonly CoinStandard[] = ['written', 'copper', 'silver', 'gold'];

/** The chosen coin standard, remembered in localStorage when the browser allows it. */
@Injectable({ providedIn: 'root' })
export class CoinStandardStore {
  private readonly value = signal<CoinStandard>(read());
  readonly standard = this.value.asReadonly();

  set(value: CoinStandard): void {
    this.value.set(value);
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // Storage blocked (private mode, disabled): keep the choice for this session only.
    }
  }
}

function read(): CoinStandard {
  try {
    const stored = localStorage.getItem(KEY);
    return STANDARDS.find(s => s === stored) ?? 'written';
  } catch {
    return 'written';
  }
}
