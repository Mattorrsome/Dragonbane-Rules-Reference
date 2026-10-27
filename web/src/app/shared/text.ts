/** "…ignoring armour." → "…ignoring armour": trims the end and drops one final full stop, so a colon can follow. */
export function withoutFinalStop(text: string): string {
  return text.trimEnd().replace(/\.$/, '');
}

/** "MAGIC SEAL" → "Magic seal": first letter capital, the rest lower case. */
export function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}
