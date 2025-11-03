import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, NotificationService } from '@kaspacom/ui';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { WalletService } from '../../../../../services/wallet.service';

interface ExportAccountFlowData {
  walletIdWithAccount?: string;
}

@Component({
  selector: 'app-export-account',
  standalone: true,
  imports: [CommonModule, KcButtonComponent],
  templateUrl: './export-account.component.html',
  styleUrl: './export-account.component.scss',
})
export class ExportAccountComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);
  private notificationService = inject(NotificationService);

  walletName = signal<string>('');
  accountName = signal<string | null>(null);
  derivedPath = signal<string | null>(null);
  privateKey = signal<string>('');
  loadError = signal<boolean>(false);

  override get config(): IFlowPageConfig {
    return {
      id: 'export-account',
      title: 'Export Private Key',
      canNavigateBack: true,
      canClose: false,
      showTitle: true,
      showBackground: true,
    };
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadAccountData();
  }

  async copyPrivateKey(): Promise<void> {
    const key = this.privateKey();

    if (!key) {
      this.notificationService.error('Error', 'Private key is unavailable.');
      return;
    }

    if (!navigator?.clipboard?.writeText) {
      this.notificationService.error(
        'Error',
        'Clipboard operations are not supported in this environment.',
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(key);
      this.notificationService.success(
        'Success',
        'Private key copied to clipboard.',
      );
    } catch (error) {
      console.error('Failed to copy private key', error);
      this.notificationService.error(
        'Error',
        'Failed to copy private key to clipboard.',
      );
    }
  }

  downloadPrivateKey(): void {
    const key = this.privateKey();

    if (!key) {
      this.notificationService.error('Error', 'Private key is unavailable.');
      return;
    }

    if (typeof window === 'undefined') {
      this.notificationService.error(
        'Error',
        'File downloads are not supported in this environment.',
      );
      return;
    }

    const content = this.buildExportFileContent(key);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.buildDownloadFilename();
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    this.notificationService.success(
      'Success',
      'Private key export file generated.',
    );
  }

  navigateBackToPrevious(): void {
    this.navigateBack();
  }

  private loadAccountData(): void {
    const config = this.getCurrentConfig();
    const data = (config?.data || {}) as ExportAccountFlowData;
    const walletIdWithAccount = data.walletIdWithAccount;

    if (!walletIdWithAccount) {
      this.loadError.set(true);
      return;
    }

    const wallet = this.walletService.getWalletByIdAndAccount(
      walletIdWithAccount,
    );

    if (!wallet) {
      this.loadError.set(true);
      return;
    }

    this.walletName.set(wallet.getName());
    this.accountName.set(wallet.getAccountName() ?? null);
    this.derivedPath.set(wallet.getDerivedPath() ?? null);

    try {
      this.privateKey.set(wallet.getPrivateKey().toString());
    } catch (error) {
      console.error('Failed to resolve private key', error);
      this.loadError.set(true);
    }
  }

  private buildExportFileContent(privateKey: string): string {
    const lines: string[] = [];
    const walletLabel = this.walletName();
    const accountLabel = this.accountName();
    const path = this.derivedPath();

    if (walletLabel) {
      lines.push(`Wallet: ${walletLabel}`);
    }

    if (accountLabel) {
      lines.push(`Account: ${accountLabel}`);
    }

    if (path) {
      lines.push(`Derived Path: ${path}`);
    }

    lines.push(`Private Key: ${privateKey}`);
    return lines.join('\n');
  }

  private buildDownloadFilename(): string {
    const raw = (this.accountName() || this.walletName() || 'account')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_]+/g, '-');

    const normalized = raw.replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

    return `${normalized || 'account'}-private-key.txt`;
  }
}


