import { Component, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WalletActionResult } from '@kaspacom/wallet-messages';
import { CompletedActionOverviewService } from '../../../../../../../services/action-info-services/completed-action-overview.service';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { ApprovalFlowService } from '../../../../common/services/approval-flow.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-approval-success-page',
  standalone: true,
  imports: [
    CommonModule,
    KcButtonComponent,
    KcIconComponent
  ],
  template: `
    <div class="success-container">
      <!-- Success Header -->
      <div class="success-header">
        <h2 class="typo-title-3">Transaction Successful!</h2>
        
        <!-- Success Icon -->
        <div class="success-icon-wrapper">
          <img src="/svgs/success.svg" alt="Success" class="success-icon" width="334" height="226" />
        </div>
      </div>

      <!-- Transaction Details Spoiler -->
      <div class="details-spoiler-container" *ngIf="actionDisplay()">
        <!-- Details Toggle Header -->
        <div class="details-spoiler-toggle" (click)="toggleDetails()">
          <div class="spoiler-left">
            <kc-icon iconClass="icon-receipt" size="sm" color="#6fc7ba"></kc-icon>
            <span class="spoiler-label">Transaction Details</span>
          </div>
          <div class="spoiler-chevron">
            <kc-icon 
              [iconClass]="showDetails ? 'icon-chevron-up' : 'icon-chevron-down'" 
              size="sm" 
              color="var(--gray-60, #9E9E9E)">
            </kc-icon>
          </div>
        </div>

        <!-- Details Content (Collapsible) -->
        <div class="details-content" [@slideDown]="showDetails ? 'open' : 'closed'">
          <div class="details-inner">
            <h3 class="details-title">{{ actionDisplay()!.title }}</h3>
            
            <div class="details-grid">
              <div class="detail-item" *ngFor="let row of actionDisplay()!.rows">
                <div class="detail-label">{{ row.fieldName }}</div>
                <div class="detail-value">
                  {{ row.fieldValue }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <div class="action-button">
        <kc-button 
          [text]="'Done'"
          variant="primary" 
          size="lg"
          role="success"
          [isFullWidth]="true"
          (buttonClick)="onDone()"
          class="done-button">
        </kc-button>
      </div>
    </div>
  `,
  styleUrl: './approval-success-page.component.scss',
  animations: [
    trigger('slideDown', [
      state('closed', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden'
      })),
      state('open', style({
        height: '*',
        opacity: 1,
        overflow: 'visible'
      })),
      transition('closed => open', [
        animate('400ms ease-out')
      ]),
      transition('open => closed', [
        animate('300ms ease-in')
      ])
    ])
  ]
})
export class ApprovalSuccessPageComponent {
  private completedActionOverviewService = inject(CompletedActionOverviewService);
  private approvalFlowService = inject(ApprovalFlowService);

  @Input() actionResult!: WalletActionResult;

  // Spoiler state
  protected showDetails = false;

  actionDisplay = computed(() => 
    this.completedActionOverviewService.getActionDisplay(this.actionResult)
  );

  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  onDone() {
    this.approvalFlowService.closeApproval();
  }
} 