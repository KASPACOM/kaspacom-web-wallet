import { Component, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApprovalFlowService } from '../../services/approval-flow.service';
import { KcIconComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-approval-loading-page',
  standalone: true,
  imports: [
    CommonModule,
    KcIconComponent
  ],
  template: `
    <div class="loading-container">
      <!-- Loading Header -->
      <div class="loading-header">
        <div class="loading-icon-wrapper">
          <div class="loading-spinner">
            <kc-icon 
              [iconClass]="'icon-refresh'" 
              [size]="'xlg'"
              class="spinner-icon">
            </kc-icon>
          </div>
        </div>
        <h2 class="loading-title">Processing Transaction</h2>
        <p class="loading-subtitle">Please wait while your transaction is being processed...</p>
      </div>

      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            [style.width.%]="currentProgress()">
          </div>
        </div>
        <div class="progress-text">
          {{ currentProgress() }}%
        </div>
      </div>

      <!-- Loading Steps -->
      <div class="loading-steps">
        <div class="step" [class.active]="currentProgress() >= 50">
          <div class="step-icon">
            <kc-icon 
              [iconClass]="currentProgress() >= 50 ? 'icon-check' : 'icon-clock'" 
              [size]="'sm'">
            </kc-icon>
          </div>
          <span class="step-text">Commit</span>
        </div>
        
        <div class="step" [class.active]="currentProgress() >= 100">
          <div class="step-icon">
            <kc-icon 
              [iconClass]="currentProgress() >= 100 ? 'icon-check' : 'icon-clock'" 
              [size]="'sm'">
            </kc-icon>
          </div>
          <span class="step-text">Reveal</span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './approval-loading-page.component.scss'
})
export class ApprovalLoadingPageComponent {
  private approvalFlowService = inject(ApprovalFlowService);
  
  currentProgress = computed(() => this.approvalFlowService.currentProgress());
} 