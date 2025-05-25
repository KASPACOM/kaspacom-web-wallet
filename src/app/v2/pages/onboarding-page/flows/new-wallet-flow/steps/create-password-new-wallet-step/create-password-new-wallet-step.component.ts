import { Component, output } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-create-password-new-wallet-step',
  imports: [KcButtonComponent],
  templateUrl: './create-password-new-wallet-step.component.html',
  styleUrl: './create-password-new-wallet-step.component.scss',
})
export class CreatePasswordNewWalletStepComponent {
  next = output<void>();
  previous = output<void>();
}
