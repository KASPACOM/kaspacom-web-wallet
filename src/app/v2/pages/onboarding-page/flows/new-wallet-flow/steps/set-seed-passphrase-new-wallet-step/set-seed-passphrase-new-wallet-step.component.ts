import { Component, OnInit, inject, output, signal } from '@angular/core';
import { KcButtonComponent, KcInputComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';
import { NewWalletFlowService } from '../../service/new-wallet-flow.service';

@Component({
  selector: 'app-set-seed-passphrase-new-wallet-step',
  imports: [KcButtonComponent, KcInputComponent, FormsModule],
  templateUrl: './set-seed-passphrase-new-wallet-step.component.html',
  styleUrl: './set-seed-passphrase-new-wallet-step.component.scss',
})
export class SetSeedPassphraseNewWalletStepComponent implements OnInit {
  next = output<void>();
  previous = output<void>();

  private readonly newWalletFlowService = inject(NewWalletFlowService);

  seedPassphrase = signal<string>('');

  ngOnInit(): void {
    const walletState = this.newWalletFlowService.newWallet();
    this.seedPassphrase.set(walletState.seedPassphrase);
  }

  onSeedPassphraseChange(value: string) {
    this.seedPassphrase.set(value);
    this.newWalletFlowService.setSeedPassphrase(value);
  }

  onContinue() {
    this.next.emit();
  }

  onBack() {
    this.previous.emit();
  }
}

