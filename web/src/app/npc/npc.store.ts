import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DamageBonus, DEFAULT_MOVEMENT, Npc, SavedNpc } from './npc';

const KEY = 'dragonbane.npcs.v1';

/**
 * The GM's saved NPCs, kept in this browser's localStorage. Nothing reaches the server. Unreadable storage is ignored
 * (and left as it is until the next save), so a bad entry never breaks the page or silently wipes the rest.
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
   * Adds the NPCs in an exported file: one with a saved NPC's id replaces it, the rest are added. Unreadable entries
   * are skipped. Throws, changing nothing, when the text is not a list holding at least one readable NPC.
   */
  importJson(text: string): number {
    const parsed: unknown = JSON.parse(text);
    const found = Array.isArray(parsed) ? parsed.filter(isSaved).map(withDefaults) : [];
    if (!found.length) throw new Error('No NPCs in that file.');
    // Keyed by id in list order: a file entry replaces the saved one in place, new ids go at the end.
    const byId = new Map(this.value().map(n => [n.id, n]));
    for (const npc of found) byId.set(npc.id, npc);
    this.write([...byId.values()]);
    return new Set(found.map(n => n.id)).size;
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
    damageBonuses: Array.isArray(e.damageBonuses) ? e.damageBonuses : legacy(e).damageBonus ? [legacy(e).damageBonus!] : [],
    skills: list(e.skills),
    abilities: list(e.abilities),
    gear: list(e.gear),
    spells: list(e.spells),
  };
}

/** Entries saved before an NPC could have both a STR and an AGL bonus held one, or null. */
const legacy = (e: SavedNpc) => e as SavedNpc & { damageBonus?: DamageBonus | null };

/** The minimum a saved entry needs to be listed and edited; the rest is read as the editor wrote it. */
function isSaved(entry: unknown): entry is SavedNpc {
  const e = entry as Partial<SavedNpc> | null;
  return typeof e?.id === 'string' && typeof e.name === 'string';
}
