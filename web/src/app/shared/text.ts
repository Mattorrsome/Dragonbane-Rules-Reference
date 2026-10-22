/** "MAGIC SEAL" → "Magic seal": first letter capital, the rest lower case. */
export function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase();
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}
