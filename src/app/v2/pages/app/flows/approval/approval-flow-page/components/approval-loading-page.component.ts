import { Component, computed, inject } from '@angular/core';

import { ApprovalFlowService } from '../../../../../../services/approval-flow.service';
import { KcIconComponent } from 'kaspacom-ui';
import { KaspaNodesBackgroundComponent } from '../../../../common/components/kaspa-nodes-background/kaspa-nodes-background.component';

@Component({
  selector: 'app-approval-loading-page',
  standalone: true,
  imports: [KcIconComponent, KaspaNodesBackgroundComponent],
  template: `
    <div class="loading-container">
      <!-- Background Canvas -->
      <kaspa-nodes-background
        class="background-canvas"
      ></kaspa-nodes-background>

      <!-- Loading Header -->
      <div class="loading-header">
        <div class="loading-icon-wrapper">
          <div class="loading-spinner">
            <kc-icon
              [iconClass]="'icon-refresh'"
              [size]="'xlg'"
              class="spinner-icon"
            >
            </kc-icon>
          </div>
        </div>
        <h2 class="loading-title">Processing Transaction</h2>
        <p class="loading-subtitle">
          Please wait while your transaction is being processed...
        </p>
      </div>

      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="currentProgress()"></div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './approval-loading-page.component.scss',
})
export class ApprovalLoadingPageComponent {
  private approvalFlowService = inject(ApprovalFlowService);

  currentProgress = computed(() => this.approvalFlowService.currentProgress());
}
