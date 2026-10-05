import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui-kit';
import { AssetsManagerService } from '../../../../../../../../services/assets-manager/assets-manager.service';
import { L1_ASSET_KEYS } from '../../../../../../../../services/assets-manager/assets-stores/l1-assets-store.service';
import { DotkService } from '../../../../../../../../services/dotk/dotk.service';
import {
  DotkNameAsset,
  DotkNameDetail,
} from '../../../../../../../../services/dotk/dotk.types';
import { KaspaL1NetworkService } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import { FlowPagesService } from '../../../../../../../services/flow-pages.service';
import { CopyButtonComponent } from '../../../../../../../shared/ui/copy-button/copy-button.component';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-dotk-asset',
  standalone: true,
  imports: [
    KcButtonComponent,
    KcIconComponent,
    CopyButtonComponent,
    SkeletonComponent,
  ],
  templateUrl: './dotk-asset.component.html',
  styleUrl: './dotk-asset.component.scss',
})
export class DotkAssetComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly flowPagesService = inject(FlowPagesService);
  private readonly dotkService = inject(DotkService);
  private readonly networkService = inject(KaspaL1NetworkService);
  private readonly assetsStore =
    inject(AssetsManagerService).getAllAssetStores().l1;
  private readonly dotkAssets = this.assetsStore.getAssetSignal(
    L1_ASSET_KEYS.dotk,
  );

  protected readonly nameKey = signal('');
  protected readonly detail = signal<DotkNameDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly ownedName = computed<DotkNameAsset | undefined>(() => {
    const key = this.nameKey();
    return this.dotkAssets()?.find((name) => name.name === key);
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const name = params.get('name') || '';
        this.nameKey.set(name);
        void this.loadDetail(name);
      });
  }

  protected sendName(): void {
    const name = this.ownedName();
    if (!name) return;

    this.flowPagesService.openFlow({
      id: 'send-dotk',
      title: `Send ${name.display}`,
      canNavigateBack: true,
      data: { name },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/home'], { queryParams: { tab: 'dotk' } });
  }

  protected openDeedInExplorer(): void {
    const deedAddress = this.detail()?.deedAddress;
    if (!deedAddress) return;

    window.open(
      `${this.networkService.getKaspaExplorerBaseurl()}/addresses/${deedAddress}`,
      '_blank',
    );
  }

  protected verificationLabel(): string {
    if (this.detail()?.proven === true) return 'Verified on-chain';
    if (this.detail()?.proven === false) return 'Not verified';
    return 'Verification unavailable';
  }

  private async loadDetail(name: string): Promise<void> {
    if (!name) {
      this.detail.set(null);
      this.error.set('Dot.K name is missing');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      const detail = await this.dotkService.getNameDetail(name);
      if (this.nameKey() !== name) return;
      this.detail.set(detail);
      if (!detail) {
        this.error.set('Dot.K name not found');
      }
    } catch (error) {
      if (this.nameKey() !== name) return;
      console.error('Failed to load Dot.K name details:', error);
      this.detail.set(null);
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Failed to load Dot.K name details',
      );
    } finally {
      if (this.nameKey() === name) {
        this.loading.set(false);
      }
    }
  }
}
