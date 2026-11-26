/** "…ignoring armour." → "…ignoring armour": trims the end and drops one final full stop, so a colon can follow. */
export function withoutFinalStop(text: string): string {
  return text.trimEnd().replace(/\.$/, '');
}

/** "MAGIC SEAL" → "Magic seal": first letter capital, the rest lower case. */
export function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

/** "Crossbows", "Hunting and Fishing" → "crossbows", "hunting-and-fishing": an element id has no spaces. */
export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
