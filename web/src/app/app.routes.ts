import { Routes } from '@angular/router';

const sections = ['skills', 'heroic-abilities', 'spells', 'equipment', 'treasure'];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'reference/skills' },
  {
    path: 'reference',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'skills' },
      { path: 'skills', title: 'Skills', loadComponent: () => import('./features/skills/skills.page').then(m => m.SkillsPage) },
      {
        path: 'heroic-abilities',
        title: 'Heroic Abilities',
        loadComponent: () => import('./features/heroic-abilities/heroic-abilities.page').then(m => m.HeroicAbilitiesPage),
      },
      { path: 'spells', title: 'Spells', loadComponent: () => import('./features/spells/spells.page').then(m => m.SpellsPage) },
      { path: 'equipment', title: 'Equipment', loadComponent: () => import('./features/equipment/equipment.page').then(m => m.EquipmentPage) },
      { path: 'treasure', title: 'Treasure', loadComponent: () => import('./features/treasure/treasure.page').then(m => m.TreasurePage) },
    ],
  },
  { path: 'npcs', title: 'NPC Manager', loadComponent: () => import('./features/npcs/npcs.page').then(m => m.NpcsPage) },
  // Bookmarks from before the Reference moved under /reference (query params carry over).
  ...sections.map(path => ({ path, redirectTo: `reference/${path}` })),
  { path: '**', redirectTo: 'reference/skills' },
];
