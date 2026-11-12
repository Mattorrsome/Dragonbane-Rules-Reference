import { definedOnly } from './http';

describe('definedOnly', () => {
  it('drops missing and blank values and trims text', () => {
    expect(definedOnly({ a: undefined, b: null, c: '', d: '  ', e: ' short sword ', f: 0 })).toEqual({ e: 'short sword', f: 0 });
  });
});
