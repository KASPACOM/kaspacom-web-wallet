import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KcInputComponent } from 'kaspacom-ui';
import { Subject } from 'rxjs';
import { TokenSearchService } from '../../services/token-search.service';

@Component({
  selector: 'app-search-bar',
  imports: [KcInputComponent, FormsModule],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
})
export class SearchBarComponent implements OnDestroy, AfterViewInit {
  private readonly _tokenSearchService = inject(TokenSearchService);
  private readonly _renderer = inject(Renderer2);
  private readonly elRef = inject(ElementRef);

  protected currentQuery = computed(() =>
    this._tokenSearchService.currentQuery(),
  );

  destroy$ = new Subject<true>();
  private unlistenClearButton!: () => void;

  onValueChange(event: string) {
    this._tokenSearchService.currentQuery.set(event);
  }

  clear = () => {
    this._tokenSearchService.currentQuery.set('');
  };

  ngAfterViewInit(): void {
    setTimeout(() => {
      const clearButtonEl = this.elRef.nativeElement.querySelector(
        '.kc-input-right-content',
      );
      this.unlistenClearButton = this._renderer.listen(
        clearButtonEl,
        'click',
        this.clear,
      );
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next(true);
    this._tokenSearchService.currentQuery.set('');
    this.unlistenClearButton && this.unlistenClearButton();
  }
}
