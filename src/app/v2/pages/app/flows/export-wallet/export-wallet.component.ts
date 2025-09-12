import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, NotificationService } from '@kaspacom/ui';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { WalletService } from '../../../../../services/wallet.service';
import { PasswordManagerService } from '../../../../../services/password-manager.service';
import { SeedPhraseWordComponent } from '../../../onboarding-page/flows/new-wallet-flow/steps/create-seed-phrase-new-wallet-step/component/seed-phrase-word/seed-phrase-word.component';

@Component({
  selector: 'app-export-wallet',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, SeedPhraseWordComponent],
  templateUrl: './export-wallet.component.html',
  styleUrl: './export-wallet.component.scss',
})
export class ExportWalletComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);
  private passwordManagerService = inject(PasswordManagerService);
  private notificationService = inject(NotificationService);

  get config(): IFlowPageConfig {
    return {
      id: 'export-wallet',
      title: 'Export Wallet',
      canNavigateBack: true,
      canClose: false,
      showTitle: true,
      showBackground: true,
    };
  }

  seedWords = signal<string[]>([]);
  hasMnemonic = signal<boolean>(true);

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await this.loadMnemonic();
  }

  private async loadMnemonic(): Promise<void> {
    const currentWallet = this.walletService.getCurrentWallet();
    if (!currentWallet) {
      this.hasMnemonic.set(false);
      return;
    }

    try {
      const userData = await this.passwordManagerService.getUserData();
      const savedWallet = userData.wallets.find(
        (w) => w.id === currentWallet.getId(),
      );
      const mnemonic = savedWallet?.mnemonic || '';
      if (!mnemonic) {
        this.hasMnemonic.set(false);
        return;
      }
      this.seedWords.set(mnemonic.split(' ').filter(Boolean));
    } catch (_) {
      this.hasMnemonic.set(false);
    }
  }

  copySeedToClipboard(): void {
    const content = this.getNumberedSeedString();
    navigator.clipboard.writeText(content).then(
      () => {
        this.notificationService.success(
          'Success',
          'Seed phrase copied to clipboard.',
        );
      },
      (error) => {
        console.error('Failed to copy seed phrase: ', error);
        this.notificationService.error(
          'Error',
          'Failed to copy seed phrase to clipboard.',
        );
      },
    );
  }

  downloadSeedAsTxt(): void {
    const content = this.getNumberedSeedString();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wallet-seed.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  private getNumberedSeedString(): string {
    const words = this.seedWords();
    return words.map((w, i) => `${i + 1}. ${w}`).join(' ');
  }
}
