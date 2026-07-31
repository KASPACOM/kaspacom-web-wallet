import {
  Component,
  ElementRef,
  Input,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  KcInputComponent,
  KcIconComponent,
  KcSpinnerComponent,
  KcTooltipDirective,
} from '@kaspacom/ui-kit';
import { CopyButtonComponent } from '../../copy-button/copy-button.component';
import {
  AddressResolutionService,
  AddressResolutionResult,
} from '../../../../../services/address-resolution.service';

@Component({
  selector: 'app-address-smart-input',
  standalone: true,
  imports: [
    FormsModule,
    KcInputComponent,
    KcIconComponent,
    KcSpinnerComponent,
    CopyButtonComponent,
    KcTooltipDirective,
  ],
  templateUrl: './address-smart-input.component.html',
  styleUrl: './address-smart-input.component.scss',
})
export class AddressSmartInputComponent implements OnChanges {
  private readonly resolver = inject(AddressResolutionService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly label = input<string>('Wallet Address');
  readonly placeholder = input<string>('Enter wallet address or KNS domain');
  readonly isDisabled = input<boolean>(false);
  readonly isFullWidth = input<boolean>(true);
  readonly showQrButton = input<boolean>(true);
  // TODO: Skipped for migration because:
  //  Your application code writes to the input. This prevents migration.
  @Input() value: string = '';
  readonly isValid = input<boolean>(true);
  readonly invalidReason = input<string>('');
  readonly validationDebounceMs = input<number>(300);

  readonly valueChange = output<string>();
  readonly resolved = output<AddressResolutionResult>();
  readonly qrClick = output<void>();

  isResolving = signal<boolean>(false);
  resolvedAddress = signal<string>('');
  resolvedDomain = signal<string>('');
  resolveError = signal<string>('');
  isDomainCandidate = signal<boolean>(false);

  displayIsValid = signal<boolean>(true);
  displayInvalidReason = signal<string>('');

  private debounceTimer: any = null;
  private validationTimer: any = null;
  protected inputValue = signal<string>('');

  ngOnChanges(changes: SimpleChanges): void {
    if ('value' in changes) {
      this.inputValue.set(this.value ?? '');
    }

    if ('isValid' in changes || 'invalidReason' in changes) {
      if (this.validationTimer) {
        clearTimeout(this.validationTimer);
      }
      this.validationTimer = setTimeout(() => {
        // Do not surface external validation while we're resolving or considering a domain
        if (!this.isResolving() && !this.isDomainCandidate()) {
          this.displayIsValid.set(this.isValid());
          this.displayInvalidReason.set(this.invalidReason());
        }
      }, this.validationDebounceMs());
    }
  }

  onInputChange(val: string | null | undefined) {
    const nextValue = val ?? '';
    if (nextValue === this.inputValue()) return;
    if (!this.isInputInteractionActive()) return;

    this.inputValue.set(nextValue);
    this.valueChange.emit(nextValue);

    const input = nextValue.trim();

    // Immediately clear any previously displayed errors when user changes input
    this.resolveError.set('');
    this.displayInvalidReason.set('');
    this.displayIsValid.set(true);

    // Show resolving spinner during debounce for domains and address validation
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
      // Might be an invalid address - show spinner while validating
      this.isResolving.set(true);
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
    const input = this.inputValue().trim();
    this.resolvedAddress.set('');
    this.resolvedDomain.set('');
    this.resolveError.set('');

    if (!input) {
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
      this.resolved.emit({ effectiveAddress: null, source: 'none' });
      return;
    }

    // Always try to resolve through the service to get proper validation
    const result = await this.resolver.resolve(input);

    if (result.source === 'direct') {
      // Valid kaspa address - don't show resolved address section but ensure validation states are correct
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
      this.resolvedAddress.set(''); // Clear resolved address for direct addresses
      this.resolvedDomain.set('');
      this.resolveError.set('');
      // Make sure the address is marked as valid for the warning display
      this.displayIsValid.set(true);
      this.displayInvalidReason.set('');
    } else if (result.source === 'kns') {
      // KNS domain resolution - show resolved address section
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);

      if (result.effectiveAddress) {
        this.resolvedAddress.set(result.effectiveAddress);
        if (result.resolvedDomain)
          this.resolvedDomain.set(result.resolvedDomain);
        this.resolveError.set('');
        this.displayIsValid.set(true);
        this.displayInvalidReason.set('');
      } else if (result.error) {
        this.resolveError.set(result.error);
        this.resolvedAddress.set('');
        this.resolvedDomain.set('');
        this.displayIsValid.set(false);
        this.displayInvalidReason.set('');
      }
    } else {
      // source === 'none' - either empty, or no resolution attempted, or validation error
      this.isResolving.set(false);
      this.isDomainCandidate.set(false);
      this.resolvedAddress.set('');
      this.resolvedDomain.set('');

      if (result.error) {
        // Address format validation error
        this.resolveError.set(result.error);
        this.displayIsValid.set(false);
        this.displayInvalidReason.set('');
      } else {
        this.resolveError.set('');
        this.displayIsValid.set(true);
        this.displayInvalidReason.set('');
      }
    }

    this.resolved.emit(result);
  }

  protected shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }

  private isInputInteractionActive(): boolean {
    const activeElement = this.host.nativeElement.ownerDocument?.activeElement;
    return !!activeElement && this.host.nativeElement.contains(activeElement);
  }
}
