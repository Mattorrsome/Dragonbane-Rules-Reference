import { EquipmentCategoryDto, EquipmentItemDto } from '../../api/models';
import { cellText, columnsFor } from './columns';

const category: EquipmentCategoryDto = { id: 9, name: 'Medicine', nameHeader: 'Item', effectHeader: 'Effect', hasWeight: true, canResell: true, note: null };
const potion = { weapon: null, armour: null } as EquipmentItemDto;

describe('columnsFor', () => {
  it('marks Supply and Weight as list-only, so a summary can drop them', () => {
    const summary = columnsFor(category, potion).filter(c => !c.listOnly).map(c => c.header);

    expect(summary).toEqual(['Cost', 'Effect']);
  });
});

describe('wide columns', () => {
  it('flags the long text columns: the category effect and weapon Features', () => {
    const weapon = { weapon: {}, armour: null } as EquipmentItemDto;
    const wide = (item: EquipmentItemDto) => columnsFor(category, item).filter(c => c.wide).map(c => c.header);

    expect(wide(potion)).toEqual(['Effect']);
    expect(wide(weapon)).toEqual(['Features']);
  });
});

describe('cellText', () => {
  it('shows a dash for an empty value and text otherwise', () => {
    expect([null, undefined, '', 0, 'Rare'].map(cellText)).toEqual(['-', '-', '-', '0', 'Rare']);
  });
});
