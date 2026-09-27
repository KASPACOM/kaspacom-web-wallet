import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { DotkNameAsset } from '../../../../../../../../services/dotk/dotk.types';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-dotk-summary',
  standalone: true,
  imports: [SkeletonComponent],
  templateUrl: './dotk-summary.component.html',
  styleUrl: './dotk-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class DotkSummaryComponent {
  private readonly assetsStore =
    inject(AssetsManagerService).getAllAssetStores().l1;
  private readonly router = inject(Router);

  readonly names = computed(
    () => this.assetsStore.getAssetSignal(L1_ASSET_KEYS.dotk)() || [],
  );
  readonly loading = computed(
    () =>
      this.assetsStore.getAssetSignal(L1_ASSET_KEYS.dotk)() === undefined ||
      this.assetsStore.getAssetLoadingSignal(L1_ASSET_KEYS.dotk)(),
  );
  readonly loadingSkeletons = Array.from({ length: 5 });

  openName(name: DotkNameAsset): void {
    this.router.navigate(['/app/home/asset/dotk', name.name]);
  }
}
