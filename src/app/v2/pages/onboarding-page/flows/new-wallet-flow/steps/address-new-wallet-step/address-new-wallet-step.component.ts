import { Component, output } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-address-new-wallet-step',
  imports: [KcButtonComponent],
  templateUrl: './address-new-wallet-step.component.html',
  styleUrl: './address-new-wallet-step.component.scss',
})
export class AddressNewWalletStepComponent {
  next = output<void>();
  previous = output<void>();
}
