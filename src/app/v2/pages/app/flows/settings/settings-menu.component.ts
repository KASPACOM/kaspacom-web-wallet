import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import { FlowPageBaseComponent } from '../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../common/flow-page/interfaces/flow-page.interface';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { FlowPageId } from '../../common/flow-page/flow-page.registry';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './settings-menu.component.html',
  styleUrl: './settings-menu.component.scss',
})
export class SettingsMenuComponent extends FlowPageBaseComponent {
  get config(): IFlowPageConfig {
    return {
      id: 'settings-menu' as FlowPageId,
      title: 'Settings',
      canNavigateBack: true,
      canClose: true,
      showTitle: true,
      showBackground: true,
    };
  }

  onExportWallet(): void {
    this.flowPagesService.navigateToPage({
      id: 'export-kaspacom-wallet' as FlowPageId,
      title: 'Export Kaspacom Wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
  }

  onDisconnect(): void {
    this.flowPagesService.navigateToPage({
      id: 'disconnect-confirmation' as FlowPageId,
      title: 'Disconnect Wallet',
      canNavigateBack: true,
      showTitle: true,
      showBackground: true,
    });
  }
}
