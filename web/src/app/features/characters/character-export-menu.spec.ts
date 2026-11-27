import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Character } from '../../character/character';
import { creationRef } from '../../character/character.fixture';
import { CharacterExportMenu } from './character-export-menu';

const hero: Character = {
  name: 'Aodhan', nickname: '', kin: 'Human', profession: 'Mage', school: null, age: 'Adult',
  attributes: { STR: 10, CON: 10, AGL: 10, INT: 10, WIL: 10, CHA: 10 },
  skills: [], abilities: [], kinAbilities: [], spells: [], gear: [], copper: 0, weakness: '', memento: '', appearance: '',
};

describe('CharacterExportMenu', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [CharacterExportMenu], providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('shows the export card and remembers the descriptions checkbox', () => {
    const fixture = TestBed.createComponent(CharacterExportMenu);
    fixture.componentRef.setInput('character', hero);
    fixture.componentRef.setInput('ref', creationRef);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.export-card .npc-card-name')?.textContent).toBe('Aodhan');
    host.querySelector<HTMLInputElement>('#export-descriptions')!.click();
    expect(localStorage.getItem('dragonbane.characterExport.descriptions')).toBe('true');
  });

  it('offers the sheet PDF under Download', () => {
    const fixture = TestBed.createComponent(CharacterExportMenu);
    fixture.componentRef.setInput('character', hero);
    fixture.componentRef.setInput('ref', creationRef);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    [...host.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Download')!.click();
    fixture.detectChanges();
    expect(host.querySelector('button[aria-label="Download PDF"]')).not.toBeNull();
  });
});
