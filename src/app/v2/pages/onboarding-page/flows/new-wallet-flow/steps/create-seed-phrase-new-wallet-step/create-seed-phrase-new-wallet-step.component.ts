import { Component, OnInit, inject, output, signal } from '@angular/core';
import {
  KcButtonComponent,
  KcSnackbarComponent,
  NotificationService,
} from 'kaspacom-ui';
import { RadioInputComponent } from '../../../../../../shared/ui/input/radio/radio-input/radio-input.component';
import { SeedPhraseWordComponent } from './component/seed-phrase-word/seed-phrase-word.component';
import { WalletService } from '../../../../../../../services/wallet.service';
import { CheckboxInputComponent } from '../../../../../../shared/ui/input/checkbox/checkbox-input/checkbox-input.component';
import { NewWalletFlowService } from '../../service/new-wallet-flow.service';

@Component({
  selector: 'app-create-seed-phrase-new-wallet-step',
  imports: [
    KcButtonComponent,
    KcSnackbarComponent,
    RadioInputComponent,
    SeedPhraseWordComponent,
    CheckboxInputComponent,
  ],
  templateUrl: './create-seed-phrase-new-wallet-step.component.html',
  styleUrl: './create-seed-phrase-new-wallet-step.component.scss',
})
export class CreateSeedPhraseNewWalletStepComponent implements OnInit {
  next = output<void>();
  previous = output<void>();

  private readonly walletService = inject(WalletService);

  private readonly notificationService = inject(NotificationService);

  private readonly newWalletFlowService = inject(NewWalletFlowService);

  wordCount = signal<number>(12);

  seedPhrase = signal<string[]>([]);

  seedPhraseSaved = signal<boolean>(false);

  ngOnInit(): void {
    const walletState = this.newWalletFlowService.newWallet();
    if (walletState.seedPhrase !== '') {
      this.seedPhrase.set(walletState.seedPhrase.split(' '));
      this.wordCount.set(walletState.seedPhraseWordCount);
      this.seedPhraseSaved.set(walletState.seedPhraseSaved);
    } else {
      this.seedPhrase.set(
        this.walletService.generateMnemonic(this.wordCount()).split(' '),
      );
    }
  }

  onWordCountChange(count: number): void {
    this.wordCount.set(count);
    this.renewSeedPhrase();
  }

  addToClipboard() {
    navigator.clipboard.writeText(this.seedPhrase().join(' ')).then(
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

  renewSeedPhrase() {
    this.seedPhrase.set(
      this.walletService.generateMnemonic(this.wordCount()).split(' '),
    );
    this.onSeedPhraseSavedChange(false);
  }

  onSeedPhraseSavedChange(event: boolean) {
    this.seedPhraseSaved.set(event);
    this.newWalletFlowService.submitSeedPhraseSaved(this.seedPhraseSaved());
  }

  async onContinue() {
    if (!this.seedPhraseSaved()) {
      return;
    }
    const result = await this.newWalletFlowService.submitSeedPhraseStep(
      this.seedPhrase().join(' '),
      this.wordCount(),
    );
    if (result.success) {
      this.next.emit();
    } else {
      this.notificationService.error(
        'Error',
        result.error ?? 'Failed to create wallet.',
      );
    }
  }
}
