import { download, fileName } from './file';

describe('fileName', () => {
  it('slugs the NPC name', () => {
    expect(fileName('Grok', 'png', 'npc')).toBe('grok.png');
    expect(fileName("Old Tom's Bandit #2", 'md', 'npc')).toBe('old-toms-bandit-2.md');
    expect(fileName('  Skarde   the Grim ', 'txt', 'npc')).toBe('skarde-the-grim.txt');
  });

  it('falls back to the fallback name when nothing usable is left', () => {
    expect(fileName('', 'txt', 'npc')).toBe('npc.txt');
    expect(fileName('★ ★', 'png', 'npc')).toBe('npc.png');
  });

  it('handles the pdf and json extensions and a custom fallback', () => {
    expect(fileName('Aodhan', 'pdf', 'character')).toBe('aodhan.pdf');
    expect(fileName('!!', 'json', 'character')).toBe('character.json');
  });

  it('keeps letters with accents', () => {
    expect(fileName('Ásgerd', 'md', 'npc')).toBe('ásgerd.md');
  });
});

describe('download', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a link to the blob and frees the URL only after the browser has started the download', () => {
    vi.useFakeTimers();
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });

    download(new Blob(['x']), 'grok.txt');

    expect(clicked).toEqual(['grok.txt']);
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
