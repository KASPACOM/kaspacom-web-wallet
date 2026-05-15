import { Component, computed, inject, input, resource } from '@angular/core';
import { UtilsService } from '../../../../../../../../services/utils/utils.service';
import { ComponentSize } from '../../../../../common/types/sizing.type';

@Component({
  selector: 'erc20-token-logo',
  imports: [],
  templateUrl: './erc20-token-logo.component.html',
  styleUrl: './erc20-token-logo.component.scss',
})
export class Erc20TokenLogoComponent {
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
