import { Component, computed, input, output } from '@angular/core';

import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { TokenLogoComponent } from '../../../../../../../components/token-logo/token-logo.component';
import { SwapContext } from '../../../../../../services/swap-context.service';
import { CommaFormatterPipe } from '../../../../../../../pipes/comma-formatter.pipe';

@Component({
  selector: 'app-swap-approval',
  standalone: true,
  imports: [
    KcButtonComponent,
    KcIconComponent,
    TokenLogoComponent,
    CommaFormatterPipe,
  ],
  templateUrl: './swap-approval.component.html',
  styleUrl: './swap-approval.component.scss',
})
export class SwapApprovalComponent {
  swapContext = input.required<SwapContext>();
  isLoading = input<boolean>(false);
  canApprove = input<boolean>(true);

  approve = output<void>();
  reject = output<void>();

  // Computed properties for display
  fromToken = computed(() => this.swapContext().fromToken);
  toToken = computed(() => this.swapContext().toToken);
  fromAmount = computed(() => this.swapContext().fromAmount || '0');
  toAmount = computed(() => this.swapContext().toAmount || '0');
  minReceived = computed(() => this.swapContext().minReceived || '0');
  route = computed(() => this.swapContext().route || '-');
  slippage = computed(() => this.swapContext().settings?.maxSlippage || '0.5');
  deadline = computed(
    () => this.swapContext().settings?.swapDeadline?.toString() || '20',
  );
  networkName = computed(() => this.swapContext().networkName || 'Unknown');
  priceImpact = computed(() => this.swapContext().priceImpact || '0');
  estimatedGas = computed(() => this.swapContext().estimatedGas || '0');

  onApprove() {
    this.approve.emit();
  }

  onReject() {
    this.reject.emit();
  }
}
