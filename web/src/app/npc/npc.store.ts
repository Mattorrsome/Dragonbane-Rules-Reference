import { Injectable, signal } from '@angular/core';
import { DEFAULT_MOVEMENT, Npc, SavedNpc } from './npc';

const KEY = 'dragonbane.npcs.v1';

/**
 * The GM's saved NPCs, kept in this browser's localStorage. Nothing reaches the server. Unreadable storage is ignored
 * (and left as it is until the next save), so a bad entry never breaks the page or silently wipes the rest.
 */
@Injectable({ providedIn: 'root' })
export class NpcStore {
  private readonly value = signal<readonly SavedNpc[]>(read());
  readonly npcs = this.value.asReadonly();

  /** Adds a new NPC (no id) or replaces the saved one with the same id; returns it as saved. */
  save(npc: Npc & { id?: string }): SavedNpc {
    const saved: SavedNpc = { ...npc, id: npc.id ?? crypto.randomUUID() };
    const list = this.value();
    const at = list.findIndex(n => n.id === saved.id);
    this.write(at < 0 ? [...list, saved] : list.map((n, i) => (i === at ? saved : n)));
    return saved;
  }

  remove(id: string): void {
    this.write(this.value().filter(n => n.id !== id));
  }

  private write(list: readonly SavedNpc[]): void {
    this.value.set(list);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // Storage blocked or full: keep the NPCs for this session only.
    }
  }
}

function read(): SavedNpc[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isSaved).map(withDefaults) : [];
  } catch {
    return [];
  }
}

/** Fills fields an older or hand-edited entry lacks, so the editor and card never meet a missing list. */
function withDefaults(e: SavedNpc): SavedNpc {
  const list = <T>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
  return {
    id: e.id,
    name: e.name,
    description: typeof e.description === 'string' ? e.description : '',
    basedOn: typeof e.basedOn === 'string' ? e.basedOn : '',
    movement: typeof e.movement === 'number' ? e.movement : DEFAULT_MOVEMENT,
    hp: typeof e.hp === 'number' ? e.hp : 0,
    wp: typeof e.wp === 'number' ? e.wp : null,
    damageBonus: e.damageBonus ?? null,
    skills: list(e.skills),
    abilities: list(e.abilities),
    gear: list(e.gear),
    spells: list(e.spells),
  };
}

/** The minimum a saved entry needs to be listed and edited; the rest is read as the editor wrote it. */
function isSaved(entry: unknown): entry is SavedNpc {
  const e = entry as Partial<SavedNpc> | null;
  return typeof e?.id === 'string' && typeof e.name === 'string';
}
