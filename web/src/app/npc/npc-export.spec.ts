import { download, fileName } from './npc-export';

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
