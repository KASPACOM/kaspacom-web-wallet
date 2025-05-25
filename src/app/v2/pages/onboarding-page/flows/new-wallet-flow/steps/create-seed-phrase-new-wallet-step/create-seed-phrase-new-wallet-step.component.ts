import { Component, output } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-create-seed-phrase-new-wallet-step',
  imports: [KcButtonComponent],
  templateUrl: './create-seed-phrase-new-wallet-step.component.html',
  styleUrl: './create-seed-phrase-new-wallet-step.component.scss',
})
export class CreateSeedPhraseNewWalletStepComponent {
  next = output<void>();
  previous = output<void>();
}
