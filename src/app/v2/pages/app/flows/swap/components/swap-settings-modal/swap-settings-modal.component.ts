import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcBaseModalComponent, KcInputComponent, KcButtonComponent } from '@kaspacom/ui';
import type { SwapSettings } from '@kaspacom/swap-sdk';

@Component({
    selector: 'app-swap-settings-modal',
    standalone: true,
    imports: [CommonModule, KcBaseModalComponent, KcInputComponent, KcButtonComponent],
    templateUrl: './swap-settings-modal.component.html',
    styleUrl: './swap-settings-modal.component.scss'
})
export class SwapSettingsModalComponent {
    @Input() open = false;
    @Input() set initialSettings(value: Partial<SwapSettings> | undefined) {
        if (value) {
            this.maxSlippage.set(value.maxSlippage || '0.5');
            this.swapDeadline.set(value.swapDeadline || 20);
        }
    }
    @Output() close = new EventEmitter<void>();
    @Output() save = new EventEmitter<SwapSettings>();

    maxSlippage = signal<string>('0.5');
    swapDeadline = signal<number>(20);

    onMaxSlippageChange(value: string) {
        this.maxSlippage.set(value);
    }

    onSwapDeadlineChange(value: string) {
        const numValue = Math.max(0, Math.round(parseFloat(value || '0')));
        this.swapDeadline.set(numValue);
    }

    onSave() {
        this.save.emit({
            maxSlippage: this.maxSlippage(),
            swapDeadline: this.swapDeadline()
        });
    }

    onClose() {
        this.close.emit();
    }
}
