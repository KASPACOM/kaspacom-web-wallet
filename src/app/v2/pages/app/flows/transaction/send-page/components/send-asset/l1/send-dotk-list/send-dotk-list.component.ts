import { Component, computed, inject } from '@angular/core';
import { AssetsManagerService } from '../../../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { DotkNameAsset } from '../../../../../../../../../../services/dotk/dotk.types';
import { SkeletonComponent } from '../../../../../../../../../shared/ui/skeleton/skeleton.component';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';

@Component({
  selector: 'app-send-dotk-list',
  standalone: true,
  imports: [SkeletonComponent],
  templateUrl: './send-dotk-list.component.html',
  styleUrl: './send-dotk-list.component.scss',
})
export class SendDotkListComponent extends FlowPageBaseComponent {
  private readonly assetsStore =
    inject(AssetsManagerService).getAllAssetStores().l1;

  readonly names = computed(
    () => this.assetsStore.getAssetSignal(L1_ASSET_KEYS.dotk)() || [],
  );
  readonly loading = computed(
    () => this.assetsStore.getAssetSignal(L1_ASSET_KEYS.dotk)() === undefined,
  );

  get config(): IFlowPageConfig {
    return {
      id: 'send-dotk-list',
      title: 'Select Dot.K Name',
      canNavigateBack: true,
    };
  }

  selectName(name: DotkNameAsset): void {
    this.navigateToNextPage({
      id: 'send-dotk',
      title: `Send ${name.display}`,
      canNavigateBack: true,
      data: { name },
    });
  }
}
