import { fileName } from './npc-export';

describe('fileName', () => {
  it('slugs the NPC name', () => {
    expect(fileName('Grok', 'png')).toBe('grok.png');
    expect(fileName("Old Tom's Bandit #2", 'md')).toBe('old-toms-bandit-2.md');
    expect(fileName('  Skarde   the Grim ', 'txt')).toBe('skarde-the-grim.txt');
  });

  it('falls back to "npc" when nothing usable is left', () => {
    expect(fileName('', 'txt')).toBe('npc.txt');
    expect(fileName('★ ★', 'png')).toBe('npc.png');
  });

  it('keeps letters with accents', () => {
    expect(fileName('Ásgerd', 'md')).toBe('ásgerd.md');
  });
});
