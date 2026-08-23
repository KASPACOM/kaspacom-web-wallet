import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ComponentSize } from '../../../../../common/types/sizing.type';
import { environment } from '../../../../../../../../../environments/environment';
import { KaspaComApiService } from '../../../../../../../../services/kaspacom-api/kaspacom-api.service';

@Component({
  selector: 'krc20-token-logo',
  templateUrl: './krc20-token-logo.component.html',
  styleUrl: './krc20-token-logo.component.scss',
})
export class Krc20TokenLogoComponent {
  protected kaspaComApiService = inject(KaspaComApiService);

  ticker = input.required<string>();
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
    const ticker = this.ticker();
    if (!ticker) return '';

    try {
      const result = await this.kaspaComApiService.getTokensLogosUrl(ticker);
      if (result?.[0]?.logo) {
        return result[0].logo;
      }
    } catch (e) {}

    return '';
  }
}
