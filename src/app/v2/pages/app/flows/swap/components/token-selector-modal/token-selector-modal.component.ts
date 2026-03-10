import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcBaseModalComponent, KcInputComponent } from '@kaspacom/ui';
import type { Erc20Token } from '@kaspacom/swap-sdk';

@Component({
    selector: 'app-token-selector-modal',
    standalone: true,
    imports: [CommonModule, KcBaseModalComponent, KcInputComponent],
    templateUrl: './token-selector-modal.component.html',
    styleUrl: './token-selector-modal.component.scss'
})
export class TokenSelectorModalComponent {
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
            tokens = tokens.filter(t => t.address.toLowerCase() !== this.excludedToken!.address.toLowerCase());
        }

        if (!query) return tokens;

        return tokens.filter(token =>
            token.symbol.toLowerCase().includes(query) ||
            token.name.toLowerCase().includes(query) ||
            token.address.toLowerCase().includes(query)
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
}
