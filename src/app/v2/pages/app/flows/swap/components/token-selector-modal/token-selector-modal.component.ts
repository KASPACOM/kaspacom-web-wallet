import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { KcBaseModalComponent, KcInputComponent } from 'kaspacom-ui';
import { MessagePopupService } from '../../../../../../../services/message-popup.service';
import type { Erc20Token } from '@kaspacom/swap-sdk';
import { CommaFormatterPipe } from '../../../../../../../pipes/comma-formatter.pipe';
import { TokenLogoComponent } from '../../../../../../../components/token-logo/token-logo.component';

@Component({
  selector: 'app-token-selector-modal',
  standalone: true,
  imports: [
    CommonModule,
    KcBaseModalComponent,
    KcInputComponent,
    SlicePipe,
    CommaFormatterPipe,
    TokenLogoComponent,
  ],
  templateUrl: './token-selector-modal.component.html',
  styleUrl: './token-selector-modal.component.scss',
})
export class TokenSelectorModalComponent {
  private messagePopupService = inject(MessagePopupService);

  @Input() open = false;
  @Input() isLoading = false;
  @Input() tokens: Erc20Token[] = [];
  @Input() excludedToken: Erc20Token | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() selectToken = new EventEmitter<Erc20Token>();

  searchQuery = signal('');

  filteredTokens = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    let tokens = this.tokens;

    if (this.excludedToken) {
      tokens = tokens.filter(
        (t) =>
          t.address.toLowerCase() !== this.excludedToken!.address.toLowerCase(),
      );
    }

    if (!query) return tokens;

    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query),
    );
  });

  onSearchChange(value: string) {
    this.searchQuery.set(value);
  }

  onTokenSelect(token: Erc20Token) {
    this.selectToken.emit(token);
  }

  onClose() {
    this.close.emit();
  }

  async copyAddress(event: Event, address: string) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      this.messagePopupService.showSuccess('Address copied to clipboard');
    } catch {
      this.messagePopupService.showError('Failed to copy address');
    }
  }
}
