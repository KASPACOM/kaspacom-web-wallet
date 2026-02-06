import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, resource } from '@angular/core';
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

  imageResource = resource({
    request: () => ({ address: this.address(), ticker: this.ticker() }),
    loader: async ({ request }) => {
      return await this.utilsService.checkLogoImageUrl(
        request.address,
        request.ticker,
        false,
      );
    },
  });

  isLoading = computed(() => this.imageResource.isLoading());
  imageURL = computed(() => this.imageResource.value() ?? '');
}
