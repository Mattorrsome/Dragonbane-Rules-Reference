import { TestBed } from '@angular/core/testing';
import { SearchBox } from './search-box';

describe('SearchBox', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps a trailing space while the user pauses mid-phrase', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(SearchBox);
    fixture.componentRef.setInput('label', 'Search');
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;

    input.value = 'short ';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    expect(input.value).toBe('short ');
    expect(fixture.componentInstance.value()).toBe('short ');
  });
});
