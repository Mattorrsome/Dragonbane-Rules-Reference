import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Npc, SavedNpc } from './npc';
import { checkNpc, parseNpcFile } from './npc-file';

const KEY = 'dragonbane.npcs.v1';

/**
 * The GM's saved NPCs, kept in this browser's localStorage. Nothing reaches the server. Unreadable storage and bad
 * entries are ignored (and left as they are until the next save), so they never break the page.
 */
@Injectable({ providedIn: 'root' })
export class NpcStore {
  private readonly value = signal<readonly SavedNpc[]>(read());
  readonly npcs = this.value.asReadonly();

  constructor() {
    // Another tab saved or deleted: take its list, so this tab's next save does not overwrite it.
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) this.value.set(read());
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

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

  /** Every saved NPC, as a file another browser can import. */
  exportJson(): string {
    return JSON.stringify(this.value(), null, 2);
  }

  /**
   * Adds the NPCs in an exported file: one with a saved NPC's id replaces it, the rest are added. A file with any
   * problem changes nothing: the Error names the first problem (see parseNpcFile).
   */
  importJson(text: string): number {
    const found = parseNpcFile(text);
    // Keyed by id in list order: a file entry replaces the saved one in place, new ids go at the end.
    const byId = new Map(this.value().map(n => [n.id, n]));
    for (const npc of found) byId.set(npc.id, npc);
    this.write([...byId.values()]);
    return found.length;
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

/** The stored NPCs; an entry that fails checkNpc is left out, so one bad entry cannot break the page. */
function read(): SavedNpc[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry, i) => {
      try {
        return [checkNpc(entry, i + 1)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
