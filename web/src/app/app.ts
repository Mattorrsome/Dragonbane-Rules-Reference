import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CoinStandard } from './api/models';
import { CoinStandardStore } from './core/coin-standard.store';
import { LoadingTracker } from './core/loading';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly coins = inject(CoinStandardStore);
  protected readonly loading = inject(LoadingTracker).visible;
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => e.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  protected readonly apps = [
    { path: '/reference', label: 'Rules Reference' },
    { path: '/npcs', label: 'NPC Manager' },
    { path: '/characters', label: 'Character Creator' },
  ];
  /** Which app the page belongs to: the brand, the section tabs and the coin select follow it. */
  protected readonly currentApp = computed(() => this.apps.find(a => this.url().startsWith(a.path)) ?? this.apps[0]);
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

  constructor() {
    // Sticky table headers sit under the sticky navbar, whose height changes as it wraps. jsdom has no ResizeObserver.
    afterNextRender(() => {
      const navbar = document.querySelector<HTMLElement>('.navbar');
      if (!navbar || typeof ResizeObserver === 'undefined') return;
      new ResizeObserver(() => document.documentElement.style.setProperty('--navbar-height', `${navbar.offsetHeight}px`)).observe(navbar);
    });
  }

  protected onStandardChange(event: Event): void {
    this.coins.set((event.target as HTMLSelectElement).value as CoinStandard);
  }
}
