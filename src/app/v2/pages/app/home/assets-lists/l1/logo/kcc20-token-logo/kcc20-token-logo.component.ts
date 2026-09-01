import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ComponentSize } from '../../../../../common/types/sizing.type';
import { Kcc20MetadataApiService } from '../../../../../../../../services/kcc20-api/kcc20-metadata-api.service';

@Component({
  selector: 'kcc20-token-logo',
  templateUrl: './kcc20-token-logo.component.html',
  styleUrl: './kcc20-token-logo.component.scss',
})
export class Kcc20TokenLogoComponent {
  private kcc20MetadataApiService = inject(Kcc20MetadataApiService);

  covenantId = input.required<string>();
  size = input.required<ComponentSize>();
  imageURL: string = '';

  isLoading = signal(true);
  useFallback = signal(false);

  getImagePlaceholder = computed(() =>
    this.useFallback() ? './images/kc-all-black.png' : '',
  );

  constructor() {
    effect(() => {
      this.loadImage();
    });
  }

  async loadImage() {
    const img = new Image();
    img.onload = () => {
      this.isLoading.set(false);
    };
    img.onerror = () => {
      this.isLoading.set(false);
      this.useFallback.set(true);
    };
    const image = await this.getImageUrl();
    img.src = image;
    this.imageURL = image;
  }

  async getImageUrl() {
    const covenantId = this.covenantId();
    if (!covenantId) return '';

    try {
      const logoUrl = await this.kcc20MetadataApiService.getLogoUrl(
        covenantId,
      );
      if (logoUrl) return logoUrl;
    } catch {}

    return '';
  }
}
