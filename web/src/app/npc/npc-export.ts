/** "Old Tom's Bandit #2" → "old-toms-bandit-2.md": lower case, apostrophes dropped, other non-letters become dashes. */
export function fileName(npcName: string, ext: 'png' | 'txt' | 'md'): string {
  const slug = npcName
    .toLocaleLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'npc'}.${ext}`;
}

/** Saves a blob as a file through a temporary download link. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
