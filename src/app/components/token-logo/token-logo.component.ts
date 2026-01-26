import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { UtilsService } from '../../services/utils/utils.service';
import { ComponentSize } from '../../v2/pages/app/common/types/sizing.type';

@Component({
  selector: 'kc-token-logo',
  imports: [CommonModule],
  templateUrl: './token-logo.component.html',
  styleUrl: './token-logo.component.scss',
})
export class TokenLogoComponent {
  private readonly utilsService = inject(UtilsService);

  ticker = input.required<string>();
  address = input.required<string>();

  size = input.required<ComponentSize>();

  isLoading = signal(true);

  imageURL = computed(
    async () =>
      await this.utilsService.checkLogoImageUrl(
        this.address(),
        this.ticker(),
        false,
      ),
  );

  constructor() {
    effect(async () => {
      this.isLoading.set(true);
      await this.imageURL();
      this.isLoading.set(false);
    });
  }
}
