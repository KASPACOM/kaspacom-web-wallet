import { Component, computed, inject, OnDestroy } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, skip, Subject, switchMap, takeUntil } from 'rxjs';
import { TokenSearchService } from '../services/token-search.service';
import { SearchTokenCardComponent } from './search-token-card/search-token-card.component';

@Component({
  selector: 'app-search',
  imports: [SearchTokenCardComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnDestroy {
  private readonly _searchService = inject(TokenSearchService);

  suggestions = computed(() => this._searchService.suggestions());
  currentQuery = computed(() => this._searchService.currentQuery());

  destroy$ = new Subject<true>();

  constructor() {
    toObservable(this._searchService.currentQuery)
      .pipe(
        takeUntil(this.destroy$),
        skip(1),
        debounceTime(250),
        switchMap((query) => this._searchService.searchToken(query)),
      )
      .subscribe((suggestions) => {
        this._searchService.suggestions.set(suggestions);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.complete();
  }
}
