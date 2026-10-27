import { withoutFinalStop } from './text';

describe('withoutFinalStop', () => {
  it('drops the full stop that ends the text, so a colon can lead into the result', () => {
    expect(withoutFinalStop('Take D4 damage ignoring armour.')).toBe('Take D4 damage ignoring armour');
  });

  it('keeps stops inside the text and ignores trailing space', () => {
    expect(withoutFinalStop('Roll EVADE. On failure, take damage. \n')).toBe('Roll EVADE. On failure, take damage');
  });

  it('leaves text with no final stop alone', () => {
    expect(withoutFinalStop('D6: alcohol; healing potion 3D6 HP')).toBe('D6: alcohol; healing potion 3D6 HP');
  });
});
