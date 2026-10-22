import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
  protected readonly sections = [
    { path: '/skills', label: 'Skills' },
    { path: '/heroic-abilities', label: 'Heroic Abilities' },
    { path: '/spells', label: 'Spells' },
    { path: '/equipment', label: 'Equipment' },
    { path: '/treasure', label: 'Treasure' },
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
