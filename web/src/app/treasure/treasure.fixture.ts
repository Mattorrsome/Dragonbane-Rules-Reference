import { TreasureEntryDto, TreasureOutcomeDto, TreasureRollDto } from '../api/models';

/** Hand-built treasure DTOs in the API's shape (entries 10, 26, 30, 31, 35, 36, 37). */
const roll = (r: Partial<TreasureRollDto> & Pick<TreasureRollDto, 'label' | 'dieSides' | 'purpose'>): TreasureRollDto => ({
  sequence: 1, diceCount: 1, modifier: 0, multiplier: 1, coin: null, outcomes: [], ...r,
});

const outcome = (face: number, label: string, o: Partial<TreasureOutcomeDto> = {}): TreasureOutcomeDto => ({
  face, label, valueCopper: null, valueText: null, equipmentItemId: null, isMastercrafted: false, magicSchoolId: null, rolls: [], ...o,
});

const entry = (rollNumber: number, name: string, rolls: TreasureRollDto[]): TreasureEntryDto => ({
  id: rollNumber, roll: rollNumber, name, effectText: `${name} effect`, rolls,
});

export const TREASURE: readonly TreasureEntryDto[] = [
  entry(10, 'Silver coins', [roll({ label: 'value', diceCount: 2, dieSides: 6, multiplier: 10, purpose: 'Coins', coin: 'Silver' })]),
  entry(26, 'Gemstone', [roll({
    label: 'gemstone', dieSides: 6, purpose: 'Pick', outcomes: [
      outcome(1, 'glass', { valueCopper: 2, valueText: '2 copper' }),
      outcome(2, 'crystal', { valueCopper: 100, valueText: '10 silver' }),
      outcome(3, 'emerald', { valueCopper: 1000, valueText: '10 gold' }),
      outcome(4, 'sapphire', { valueCopper: 1500, valueText: '15 gold' }),
      outcome(5, 'ruby', { valueCopper: 2500, valueText: '25 gold' }),
      outcome(6, 'diamond', { valueCopper: 10000, valueText: '100 gold' }),
    ],
  })]),
  entry(30, 'Ranged weapon', [roll({
    label: 'weapon', dieSides: 6, purpose: 'Pick', outcomes: [
      outcome(1, 'sling', { equipmentItemId: 30 }), outcome(2, 'short bow', { equipmentItemId: 31 }),
      outcome(3, 'longbow', { equipmentItemId: 32 }), outcome(4, 'light crossbow', { equipmentItemId: 33 }),
      outcome(5, 'heavy crossbow', { equipmentItemId: 34 }), outcome(6, 'hand crossbow', { equipmentItemId: 35 }),
    ],
  })]),
  entry(31, 'Mastercrafted weapon', [roll({
    label: 'weapon', dieSides: 6, purpose: 'Pick', outcomes: [
      outcome(1, 'dagger', { equipmentItemId: 11, isMastercrafted: true }),
      outcome(2, 'short sword', { equipmentItemId: 13, isMastercrafted: true }),
      outcome(3, 'battleaxe', { equipmentItemId: 19, isMastercrafted: true }),
      outcome(4, 'broadsword', { equipmentItemId: 14, isMastercrafted: true }),
      outcome(5, 'heavy warhammer', { equipmentItemId: 25, isMastercrafted: true }),
      outcome(6, 'longsword', { equipmentItemId: 15, isMastercrafted: true }),
    ],
  })]),
  entry(35, 'Grimoire', [
    roll({
      sequence: 1, label: 'school', dieSides: 4, purpose: 'Pick', outcomes: [
        outcome(1, 'Animism', { magicSchoolId: 2 }), outcome(2, 'Elementalism', { magicSchoolId: 4 }),
        outcome(3, 'Mentalism', { magicSchoolId: 7 }), outcome(4, 'General Magic', { magicSchoolId: 1 }),
      ],
    }),
    roll({ sequence: 2, label: 'spell rank (0 = tricks)', dieSides: 4, modifier: -1, purpose: 'SpellRank' }),
    roll({ sequence: 3, label: 'spells', dieSides: 4, purpose: 'Number' }),
  ]),
  entry(36, 'Bottle', [roll({
    label: 'contents', dieSides: 6, purpose: 'Pick', outcomes: [
      outcome(1, 'lethal poison potency 12', { equipmentItemId: 110 }),
      outcome(2, 'sleeping poison potency 14', { equipmentItemId: 112 }),
      outcome(3, 'alcohol'),
      outcome(4, 'herbal concoction', { equipmentItemId: 113 }),
      outcome(5, 'healing potion 2D6 HP', { equipmentItemId: 114 }),
      outcome(6, 'healing potion 3D6 HP', { equipmentItemId: 114 }),
    ],
  })]),
  entry(37, 'Book', []),
];

export const byRoll = (r: number): TreasureEntryDto => TREASURE.find(e => e.roll === r)!;
