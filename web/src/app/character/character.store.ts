import { Injectable } from '@angular/core';
import { ListStore } from '../shared/list-store';
import { SavedCharacter } from './character';
import { checkCharacter } from './character-file';

/** The player's saved characters, kept in this browser's localStorage (see ListStore). */
@Injectable({ providedIn: 'root' })
export class CharacterStore extends ListStore<SavedCharacter> {
  readonly characters = this.items;

  constructor() {
    super('dragonbane.characters.v1', checkCharacter, 'character');
  }
}
