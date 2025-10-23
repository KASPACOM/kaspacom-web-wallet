import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';

@Component({
  selector: 'app-send-l2-erc20-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './send-l2-erc20-list.component.html',
  styleUrl: './send-l2-erc20-list.component.scss',
})
export class SendL2Erc20ListComponent extends FlowPageBaseComponent {
  get config(): IFlowPageConfig {
    return {
      id: 'send-l2-erc20-list',
      title: 'Select ERC20 Token',
      canNavigateBack: true,
    };
  }
}
