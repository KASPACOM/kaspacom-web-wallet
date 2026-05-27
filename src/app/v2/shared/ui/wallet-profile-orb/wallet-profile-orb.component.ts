import { Component, computed, effect, inject, signal } from '@angular/core';
import { WalletService } from '../../../../services/wallet.service';
import { environment } from '../../../../../environments/environment';

interface AvatarConfig {
  shapeIndex: number;
  bgColor: string;
  borderColor: string;
  imgFilter: string;
  rotation: number;
}

function computeAvatar(address: string): AvatarConfig {
  const hex = address.replace(/^0x/i, '').toLowerCase().padEnd(40, '0');
  const bytes = Array.from(
    { length: 20 },
    (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0,
  );

  const shapeIndex = 1 + (bytes[0] % 123);

  const bgHue = (bytes[1] / 255) * 360;
  const bgSat = 40 + (bytes[2] % 40);
  const bgLight = 15 + (bytes[3] % 20);

  const hueRotate = Math.round((bytes[4] / 255) * 360);
  const saturate = (0.6 + (bytes[5] / 255) * 1.4).toFixed(2);
  const brightness = (0.7 + (bytes[6] / 255) * 0.8).toFixed(2);
  const rotation = (bytes[7] % 4) * 90;

  return {
    shapeIndex,
    bgColor: `hsl(${Math.round(bgHue)}, ${bgSat}%, ${bgLight}%)`,
    borderColor: `hsl(${Math.round(bgHue)}, ${bgSat}%, 65%)`,
    imgFilter: `hue-rotate(${hueRotate}deg) saturate(${saturate}) brightness(${brightness})`,
    rotation,
  };
}

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash | 0;
  }
  return Math.abs(hash);
}

interface L1AvatarConfig {
  tokenId: string;
  imgFilter: string;
  bgColor: string;
}

function computeL1Avatar(address: string): L1AvatarConfig {
  const h = djb2(address);
  const hue = h % 360;
  const saturate = 100 + ((h >>> 4) % 60);
  const contrast = 95 + ((h >>> 8) % 20);
  const bgSat = 40 + ((h >>> 12) % 30);
  const bgLight = 15 + ((h >>> 16) % 15);
  return {
    tokenId: ((h % 10000) + 1).toString(),
    imgFilter: `hue-rotate(${hue}deg) saturate(${saturate}%) contrast(${contrast}%)`,
    bgColor: `hsl(${hue}, ${bgSat}%, ${bgLight}%)`,
  };
}

@Component({
  selector: 'app-wallet-profile-orb',
  standalone: true,
  imports: [],
  templateUrl: './wallet-profile-orb.component.html',
  styleUrl: './wallet-profile-orb.component.scss',
})
export class WalletProfileOrbComponent {
  private walletService = inject(WalletService);

  readonly yonatoshiBaseUrl = `${environment.krc721CacheStreamUrl}/optimized/${environment.l1AvatarCollection}`;

  isL2 = this.walletService.getIsL2DisplaySignal();
  walletAddress = this.walletService.getCurrentDisplayWalletAddressAsString;

  avatarConfig = computed((): AvatarConfig => computeAvatar(this.walletAddress()));
  l1AvatarConfig = computed((): L1AvatarConfig => computeL1Avatar(this.walletAddress()));
  l1AvatarError = signal(false);

  constructor() {
    effect(() => {
      this.walletAddress();
      this.l1AvatarError.set(false);
    });
  }

  onL1AvatarError(): void {
    this.l1AvatarError.set(true);
  }
}
