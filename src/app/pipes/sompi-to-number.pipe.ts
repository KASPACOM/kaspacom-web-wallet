import { Pipe, PipeTransform, inject } from '@angular/core';
import { KaspaNetworkActionsService } from '../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Pipe({
  name: 'sompiToNumber',
  standalone: true,
})
export class SompiToNumberPipe implements PipeTransform {
  private readonly kaspaNetworkActionsService = inject(
    KaspaNetworkActionsService,
  );

  transform(value: string | number | bigint, ...args: unknown[]): unknown {
    return this.kaspaNetworkActionsService.sompiToNumber(BigInt(value));
  }
}
