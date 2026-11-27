import { DestroyRef, inject, signal } from '@angular/core';

type Entry = { id: string; name: string };

/**
 * Reads a list file (an export of a saved list). Stops at the first problem and throws an Error whose message says
 * what and where, in words a person can act on; nothing is returned in that case, so a bad file imports nothing.
 * `check` validates one entry (`n` is its 1-based position) and `noun` is singular ("NPC", "character").
 */
export function parseListFile<T extends Entry>(text: string, check: (entry: unknown, n: number) => T, noun: string): T[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error(`That file does not hold a list of ${noun}s.`);
  if (!parsed.length) throw new Error(`That file holds no ${noun}s.`);

  const firstWithId = new Map<string, number>();
  const Noun = noun.charAt(0).toLocaleUpperCase() + noun.slice(1);
  return parsed.map((entry, i) => {
    const item = check(entry, i + 1);
    const earlier = firstWithId.get(item.id);
    if (earlier) throw new Error(`${Noun} ${i + 1} ("${item.name}") has the same id as ${Noun} ${earlier}.`);
    firstWithId.set(item.id, i + 1);
    return item;
  });
}

/**
 * A list saved in this browser's localStorage under `key`. Nothing reaches the server. Unreadable storage and bad
 * entries are ignored (and left as they are until the next save), so they never break the page. Subclasses are
 * created through Angular's injector (the constructor injects DestroyRef).
 */
export abstract class ListStore<T extends Entry> {
  private readonly value = signal<readonly T[]>([]);
  readonly items = this.value.asReadonly();

  protected constructor(
    private readonly key: string,
    private readonly check: (entry: unknown, n: number) => T,
    private readonly noun: string,
  ) {
    this.value.set(this.read());
    // Another tab saved or deleted: take its list, so this tab's next save does not overwrite it.
    const onStorage = (event: StorageEvent) => {
      if (event.key === this.key) this.value.set(this.read());
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  /** Adds a new entry (no id) or replaces the saved one with the same id; returns it as saved. */
  save(entry: Omit<T, 'id'> & { id?: string }): T {
    const saved = { ...entry, id: entry.id ?? crypto.randomUUID() } as T;
    const list = this.value();
    const at = list.findIndex(n => n.id === saved.id);
    this.write(at < 0 ? [...list, saved] : list.map((n, i) => (i === at ? saved : n)));
    return saved;
  }

  remove(id: string): void {
    this.write(this.value().filter(n => n.id !== id));
  }

  /** Every saved entry, as a file another browser can import. */
  exportJson(): string {
    return JSON.stringify(this.value(), null, 2);
  }

  /**
   * Adds the entries in an exported file: one with a saved entry's id replaces it, the rest are added. A file with
   * any problem changes nothing: the Error names the first problem (see parseListFile).
   */
  importJson(text: string): number {
    const found = parseListFile(text, this.check, this.noun);
    // Keyed by id in list order: a file entry replaces the saved one in place, new ids go at the end.
    const byId = new Map(this.value().map(n => [n.id, n]));
    for (const item of found) byId.set(item.id, item);
    this.write([...byId.values()]);
    return found.length;
  }

  private write(list: readonly T[]): void {
    this.value.set(list);
    try {
      localStorage.setItem(this.key, JSON.stringify(list));
    } catch {
      // Storage blocked or full: keep the list for this session only.
    }
  }

  /** The stored entries; one that fails `check` is left out, so one bad entry cannot break the page. */
  private read(): T[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(this.key) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((entry, i) => {
        try {
          return [this.check(entry, i + 1)];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  }
}
