import { Injectable } from '@angular/core';
import { ListStore } from '../shared/list-store';
import { SavedNpc } from './npc';
import { checkNpc } from './npc-file';

/** The GM's saved NPCs, kept in this browser's localStorage (see ListStore). */
@Injectable({ providedIn: 'root' })
export class NpcStore extends ListStore<SavedNpc> {
  readonly npcs = this.items;

  constructor() {
    super('dragonbane.npcs.v1', checkNpc, 'NPC');
  }
}
