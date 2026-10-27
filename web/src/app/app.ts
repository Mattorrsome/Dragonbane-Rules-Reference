import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CoinStandard } from './api/models';
import { CoinStandardStore } from './core/coin-standard.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly coins = inject(CoinStandardStore);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => e.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  /** Which app the page belongs to: the brand, the section tabs and the coin select follow it. */
  protected readonly currentApp = computed(() => (this.url().startsWith('/npcs') ? 'npcs' : 'reference'));

  protected readonly apps = [
    { path: '/reference', label: 'Dragonbane Reference' },
    { path: '/npcs', label: 'NPC Manager' },
  ];
  protected readonly sections = [
    { path: '/reference/skills', label: 'Skills' },
    { path: '/reference/heroic-abilities', label: 'Heroic Abilities' },
    { path: '/reference/spells', label: 'Spells' },
    { path: '/reference/equipment', label: 'Equipment' },
    { path: '/reference/treasure', label: 'Treasure' },
  ];
  protected readonly standards: { value: CoinStandard; label: string }[] = [
    { value: 'written', label: 'As written' },
    { value: 'copper', label: 'Copper' },
    { value: 'silver', label: 'Silver' },
    { value: 'gold', label: 'Gold' },
  ];

  protected onStandardChange(event: Event): void {
    this.coins.set((event.target as HTMLSelectElement).value as CoinStandard);
  }
}
