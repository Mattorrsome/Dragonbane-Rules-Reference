import { Resource, signal } from '@angular/core';
import { definedOnly, held } from './http';

describe('definedOnly', () => {
  it('drops missing and blank values and trims text', () => {
    expect(definedOnly({ a: undefined, b: null, c: '', d: '  ', e: ' short sword ', f: 0 })).toEqual({ e: 'short sword', f: 0 });
  });
});

describe('held', () => {
  it('keeps the last value while the resource reloads', () => {
    const value = signal<string[] | undefined>(['a']);
    const resource = { hasValue: () => value() !== undefined, value } as unknown as Resource<string[] | undefined>;
    const shown = held(() => resource);
    expect(shown()).toEqual(['a']);
    value.set(undefined);
    expect(shown()).toEqual(['a']);
    value.set([]);
    expect(shown()).toEqual([]);
  });
});
