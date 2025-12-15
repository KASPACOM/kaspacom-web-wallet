import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectorRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcIconComponent } from 'kaspacom-ui';
import { QuickActionDialogComponent } from '../../quick-action-dialog.component';
import { FlowPagesService } from '../../../../../../services/flow-pages.service';

@Component({
  selector: 'app-wallet-options-quick-action-dialog',
  standalone: true,
  imports: [CommonModule, KcIconComponent, QuickActionDialogComponent],
  templateUrl: './wallet-options-quick-action-dialog.component.html',
  styleUrl: './wallet-options-quick-action-dialog.component.scss',
})
export class WalletOptionsQuickActionDialogComponent implements AfterViewInit {
  @Input() isOpen = false;
  @Input() data: any;
  @Output() backdropClick = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  private cdr = inject(ChangeDetectorRef);
  private flowPagesService = inject(FlowPagesService);

  // Internal state for animation
  isDialogOpen = false;

  ngAfterViewInit(): void {
    // Start with dialog closed, then open it to trigger animation
    setTimeout(() => {
      this.isDialogOpen = true;
      this.cdr.detectChanges();
    }, 50);
  }

  onBackdropClick(): void {
    this.closeDialog();
  }

  onClose(): void {
    this.closeDialog();
  }

  private closeDialog(): void {
    this.isDialogOpen = false;
    // Wait for animation to complete before emitting close
    setTimeout(() => {
      this.close.emit();
    }, 300);
  }

  onChangeWallet(): void {
    this.flowPagesService.navigateToPage({
      id: 'wallet-selection',
      title: 'Select wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
    this.closeDialog();
  }

  onExportWallet(): void {
    // Navigate to export wallet flow page
    this.flowPagesService.navigateToPage({
      id: 'export-wallet',
      title: 'Export Wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
    this.closeDialog();
  }
}


