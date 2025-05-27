import { Component, OnInit, inject, output, signal } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';
import { RadioInputComponent } from '../../../../../../shared/ui/input/radio/radio-input/radio-input.component';
import { SeedPhraseWordComponent } from './component/seed-phrase-word/seed-phrase-word.component';
import { WalletService } from '../../../../../../../services/wallet.service';

@Component({
  selector: 'app-create-seed-phrase-new-wallet-step',
  imports: [KcButtonComponent, RadioInputComponent, SeedPhraseWordComponent],
  templateUrl: './create-seed-phrase-new-wallet-step.component.html',
  styleUrl: './create-seed-phrase-new-wallet-step.component.scss',
})
export class CreateSeedPhraseNewWalletStepComponent implements OnInit {
  next = output<void>();
  previous = output<void>();

  private readonly walletService = inject(WalletService);

  wordCount = signal<number>(12);

  phrase = signal<string>('');

  ngOnInit(): void {
    this.phrase.set(this.walletService.generateMnemonic(this.wordCount()));
    console.log(this.phrase());
  }
}
