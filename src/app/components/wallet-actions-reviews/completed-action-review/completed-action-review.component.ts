import { Component, inject, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { WalletActionResult } from '../../../../../kaspacom-wallet-messages';
import { CompletedActionOverviewService } from '../../../services/completed-action-overview.service';
import { CompletedActionDisplay } from '../../../types/completed-action-display.type';

@Component({
  selector: 'completed-action-review',
  standalone: true,
  templateUrl: './completed-action-review.component.html',
  styleUrls: ['./completed-action-review.component.scss'],
  imports: [NgIf, NgFor, SompiToNumberPipe],
})
export class CompletedActionReview {
  completedActionOverviewService = inject(CompletedActionOverviewService);


  @Input() actionResult!: WalletActionResult;

  // get signPsktTransactionActionResultAmount(): bigint | undefined {
  //   if (!this.signPsktTransactionActionResult) {
  //     return undefined;
  //   }
    
  //   const transactionData: PsktTransaction = JSON.parse(this.signPsktTransactionActionResult.psktTransactionJson);

  //   return transactionData.outputs.reduce((acc, output) => acc + BigInt(output.value), BigInt(0));
  // }

  protected get currentActionDisplay(): CompletedActionDisplay | undefined {
    return this.completedActionOverviewService.getActionDisplay(this.actionResult);
  }
}
