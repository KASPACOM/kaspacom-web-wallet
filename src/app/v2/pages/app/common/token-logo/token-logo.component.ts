import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, signal } from '@angular/core';
import { ComponentSize } from '../types/sizing.type';

@Component({
  selector: 'kc-token-logo',
  imports: [CommonModule],
  templateUrl: './token-logo.component.html',
  styleUrl: './token-logo.component.scss',
})
export class TokenLogoComponent {
  ticker = input.required<string>();
  size = input.required<ComponentSize>();

  isLoading = signal(true);
  useFallback = signal(false);

  imageURL = computed(() => {
    const ticker = this.ticker();
    if (!ticker) return '';
    return `https://krc20-assets.kas.fyi/icons/${ticker.toUpperCase()}.jpg`;
  });

  getImagePlaceholder = computed(() =>
    this.useFallback() ? './images/kaspa-logo-black.png' : '',
  );

  constructor() {
    effect(() => {
      this.loadImage();
    });
  }

  loadImage() {
    const img = new Image();
    img.onload = () => {
      this.isLoading.set(false);
    };
    img.onerror = () => {
      this.isLoading.set(false);
      this.useFallback.set(true);
    };
    img.src = this.imageURL();
  }
}
