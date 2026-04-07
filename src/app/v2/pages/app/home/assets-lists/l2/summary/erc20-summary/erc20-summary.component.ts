import {
  Component,
  computed,
  inject,
  OnDestroy,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import {} from '@angular/common';
import { Router } from '@angular/router';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import { InfiniteScrollDirective } from '../../../../../../../../directives/infinite-scroll.directive';
import { Subject } from 'rxjs';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L2_ASSET_KEYS } from '../../../../../../../../services/assets-manager/assets-stores/l2-assets-store.service';
import { Erc20Token } from '@kaspacom/swap-sdk';
import { Erc20AssetCardComponent } from '../../asset-card/erc20-asset-card/erc20-asset-card.component';
import { KcButtonComponent } from 'kaspacom-ui';
import { FlowPagesService } from '../../../../../../../services/flow-pages.service';

@Component({
  selector: 'app-erc20-summary',
  imports: [SkeletonComponent, InfiniteScrollDirective, Erc20AssetCardComponent, KcButtonComponent],
  templateUrl: './erc20-summary.component.html',
  styleUrl: './erc20-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Erc20SummaryComponent
  implements OnDestroy, AfterViewInit
{
  private assetsManagerService = inject(AssetsManagerService);
  private router = inject(Router);
  private flowPagesService = inject(FlowPagesService);
  private destroy$ = new Subject<void>();

  @ViewChild(InfiniteScrollDirective) infiniteScroll!: InfiniteScrollDirective;

  // Show tokens immediately from assets store, enhanced with metadata when available
  tokens = computed<Erc20Token[]>(() => {
    const erc20Assets: Erc20Token[] = this.assetsManagerService.getAllAssetStores().l2.getAssets(
      L2_ASSET_KEYS.erc20,
    );

    return erc20Assets;
  });

  loading = computed(() => !this.assetsManagerService.getAllAssetStores().l2.getAssetSignal(L2_ASSET_KEYS.erc20)());

  ngAfterViewInit(): void {
    // Check initial scroll position after view init
    setTimeout(() => {
      if (this.infiniteScroll) {
        this.infiniteScroll.checkScroll();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTokenClick(token: Erc20Token): void {
    // Navigate to the KRC20 asset detail page
    this.router.navigate(['/app/home/asset/erc20', token.address]);
  }

  onImportToken(): void {
    this.flowPagesService.openFlow({
      id: 'import-token',
      title: 'Import Token',
      canNavigateBack: true,
    });
  }

  // TrackBy function to prevent unnecessary re-renders
  trackByToken(index: number, token: Erc20Token): string {
    return token.address;
  }
}
