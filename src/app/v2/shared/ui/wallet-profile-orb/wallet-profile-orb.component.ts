import { Component, computed, inject } from '@angular/core';
import { WalletService } from '../../../../services/wallet.service';

interface AvatarConfig {
  shapeIndex: number;
  bgColor: string;
  borderColor: string;
  imgFilter: string;
  rotation: number;
}

function computeAvatar(address: string): AvatarConfig {
  console.log(address);
  const hex = address.replace(/^0x/i, '').toLowerCase().padEnd(40, '0');
  const bytes = Array.from(
    { length: 20 },
    (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0,
  );

  const shapeIndex = 1 + (bytes[0] % 124);

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

@Component({
  selector: 'app-wallet-profile-orb',
  standalone: true,
  imports: [],
  templateUrl: './wallet-profile-orb.component.html',
  styleUrl: './wallet-profile-orb.component.scss',
})
export class WalletProfileOrbComponent {
  private walletService = inject(WalletService);

  isL2 = this.walletService.getIsL2DisplaySignal();
  l2Address = this.walletService.getCurrentDisplayWalletAddressAsString;

  avatarConfig = computed((): AvatarConfig => computeAvatar(this.l2Address()));
}
