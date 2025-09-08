import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  KcIconComponent,
  KcInputComponent,
  KcSpinnerComponent,
} from '@kaspacom/ui';
import { CopyButtonComponent } from '../../copy-button/copy-button.component';
import {
  AddressResolutionService,
  AddressResolutionResult,
} from '../../../../../services/address-resolution.service';

@Component({
  selector: 'app-address-smart-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KcInputComponent,
    KcIconComponent,
    KcSpinnerComponent,
    CopyButtonComponent,
  ],
  templateUrl: './address-smart-input.component.html',
  styleUrl: './address-smart-input.component.scss',
})
export class AddressSmartInputComponent implements OnChanges {
  private readonly resolver = inject(AddressResolutionService);

  @Input() label: string = 'Wallet Address';
  @Input() placeholder: string = 'Enter wallet address or KNS domain';
  @Input() isDisabled: boolean = false;
  @Input() isFullWidth: boolean = true;
  @Input() showQrButton: boolean = true;
  @Input() value: string = '';
  @Input() isValid: boolean = true;
  @Input() invalidReason: string = '';
  @Input() validationDebounceMs: number = 300;

  @Output() valueChange = new EventEmitter<string>();
  @Output() resolved = new EventEmitter<AddressResolutionResult>();
  @Output() qrClick = new EventEmitter<void>();

  isResolving = signal<boolean>(false);
  resolvedAddress = signal<string>('');
  resolvedDomain = signal<string>('');
  resolveError = signal<string>('');
  isDomainCandidate = signal<boolean>(false);

  displayIsValid = signal<boolean>(true);
  displayInvalidReason = signal<string>('');

  private debounceTimer: any = null;
  private validationTimer: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ('isValid' in changes || 'invalidReason' in changes) {
      if (this.validationTimer) {
        clearTimeout(this.validationTimer);
      }
      this.validationTimer = setTimeout(() => {
        // Do not surface external validation while we're resolving or considering a domain
        if (!this.isResolving() && !this.isDomainCandidate()) {
          this.displayIsValid.set(this.isValid);
          this.displayInvalidReason.set(this.invalidReason);
        }
      }, this.validationDebounceMs);
    }
  }

  onInputChange(val: string) {
    this.value = val || '';
    this.valueChange.emit(this.value);

    const input = (this.value || '').trim();

    // Immediately clear any previously displayed errors when user changes input
    this.resolveError.set('');
    this.displayInvalidReason.set('');
    this.displayIsValid.set(true);

    // Show resolving spinner during debounce if looks like a domain (not a kaspa address)
    if (!input) {
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
    } else if (this.resolver.isKaspaAddress(input)) {
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
    } else if (this.resolver.isPotentialDomain(input)) {
      this.isResolving.set(true);
      this.isDomainCandidate.set(true);
    } else {
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
    }

    this.triggerResolve();
  }

  triggerResolve() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.resolveNow(), 400);
  }

  async resolveNow() {
    const input = (this.value || '').trim();
    this.resolvedAddress.set('');
    this.resolvedDomain.set('');
    this.resolveError.set('');

    if (!input) {
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
      this.resolved.emit({ effectiveAddress: null, source: 'none' });
      return;
    }

    // If already a kaspa address, no need to call API
    if (this.resolver.isKaspaAddress(input)) {
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
      this.resolvedAddress.set(input);
      this.resolved.emit({ effectiveAddress: input, source: 'direct' });
      return;
    }

    // Only resolve if looks like a domain
    if (!this.resolver.isPotentialDomain(input)) {
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
      this.resolved.emit({ effectiveAddress: null, source: 'none' });
      return;
    }

    this.isResolving.set(true);
    this.isDomainCandidate.set(true);
    const result = await this.resolver.resolve(input);
    this.isResolving.set(false);
    this.isDomainCandidate.set(false);

    if (result.effectiveAddress) {
      this.resolvedAddress.set(result.effectiveAddress);
      if (result.resolvedDomain) this.resolvedDomain.set(result.resolvedDomain);
      this.resolveError.set('');
    } else if (result.error) {
      this.resolveError.set(result.error);
    }

    this.resolved.emit(result);
  }

  protected shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }
}
