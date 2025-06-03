import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EIP1193ProviderChain } from '@kaspacom/wallet-messages';

@Component({
    selector: 'add-l2-chain',
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './add-l2-chain.component.html',
    styleUrls: ['./add-l2-chain.component.scss']
})
export class AddL2ChainComponent {
  @Output() chainAdded = new EventEmitter<EIP1193ProviderChain>();
  @Output() cancelled = new EventEmitter<void>();

  chainForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.chainForm = this.fb.group({
      chainName: ['', [Validators.required]],
      chainId: ['', [Validators.required, Validators.min(1)]],
      rpcUrls: ['', [Validators.required, this.urlListValidator()]],
      currencyName: ['', [Validators.required]],
      currencySymbol: ['', [Validators.required]],
      currencyDecimals: [18, [Validators.required, Validators.min(0), Validators.max(36)]],
      blockExplorerUrls: ['', [this.urlListValidator()]]
    });
  }

  private urlListValidator() {
    return (control: any) => {
      if (!control.value) {
        return null;
      }
      const urls = control.value.split(',').map((url: string) => url.trim());
      const urlPattern = /^https?:\/\/.+/;
      const invalidUrls = urls.filter((url: string) => !urlPattern.test(url));
      return invalidUrls.length > 0 ? { invalidUrls: true } : null;
    };
  }

  onSubmit() {
    if (this.chainForm.valid) {
      const formValue = this.chainForm.value;
      const chain: EIP1193ProviderChain = {
        chainId: `0x${Number(formValue.chainId).toString(16)}`,
        chainName: formValue.chainName,
        nativeCurrency: {
          name: formValue.currencyName,
          symbol: formValue.currencySymbol,
          decimals: Number(formValue.currencyDecimals)
        },
        rpcUrls: formValue.rpcUrls.split(',').map((url: string) => url.trim()),
        blockExplorerUrls: formValue.blockExplorerUrls ? 
          formValue.blockExplorerUrls.split(',').map((url: string) => url.trim()) : 
          []
      };
      this.chainAdded.emit(chain);
    }
  }

  onCancel() {
    this.cancelled.emit();
  }
} 