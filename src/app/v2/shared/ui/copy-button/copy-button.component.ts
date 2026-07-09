import { Component, Input, signal, OnDestroy } from '@angular/core';
import { KcIconComponent } from '@kaspacom/ui-kit';

@Component({
  selector: 'app-copy-button',
  standalone: true,
  imports: [KcIconComponent],
  templateUrl: './copy-button.component.html',
  styleUrl: './copy-button.component.scss',
  host: {
    '[class.copy-button-host]': 'true',
  },
})
export class CopyButtonComponent implements OnDestroy {
  @Input() value: string = '';
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xlg' = 'xs';

  private isSuccess = signal(false);
  private successTimeout: NodeJS.Timeout | null = null;

  get iconClass(): string {
    return this.isSuccess() ? 'icon-success' : 'icon-copy';
  }

  get iconColor(): string {
    return this.isSuccess() ? 'var(--green-20)' : 'var(--gray-40)';
  }

  async copyValue(): Promise<void> {
    if (!this.value) return;

    try {
      await navigator.clipboard.writeText(this.value);
      this.showSuccessState();
    } catch (error) {
      console.error('Failed to copy value:', error);
    }
  }

  private showSuccessState(): void {
    // Clear any existing timeout
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }

    // Set success state
    this.isSuccess.set(true);

    // Reset to normal state after 3 seconds
    this.successTimeout = setTimeout(() => {
      this.isSuccess.set(false);
      this.successTimeout = null;
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }
  }
}
