import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EIP1193ProviderChain } from 'kaspacom-wallet-messages';

@Component({
  selector: 'add-chain',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="add-chain-container">
      <h3>Add Custom Chain</h3>
      <form [formGroup]="chainForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="chainName">Chain Name</label>
          <input id="chainName" type="text" formControlName="chainName" placeholder="e.g. My Custom Chain">
        </div>

        <div class="form-group">
          <label for="chainId">Chain ID (in hex)</label>
          <input id="chainId" type="text" formControlName="chainId" placeholder="e.g. 0x1234">
        </div>

        <div class="form-group">
          <label for="rpcUrl">RPC URL</label>
          <input id="rpcUrl" type="text" formControlName="rpcUrl" placeholder="e.g. https://rpc.example.com">
        </div>

        <div class="form-group">
          <label for="currencyName">Currency Name</label>
          <input id="currencyName" type="text" formControlName="currencyName" placeholder="e.g. My Token">
        </div>

        <div class="form-group">
          <label for="currencySymbol">Currency Symbol</label>
          <input id="currencySymbol" type="text" formControlName="currencySymbol" placeholder="e.g. MTK">
        </div>

        <div class="form-group">
          <label for="blockExplorerUrl">Block Explorer URL (optional)</label>
          <input id="blockExplorerUrl" type="text" formControlName="blockExplorerUrl" placeholder="e.g. https://explorer.example.com">
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-button" (click)="onCancel()">Cancel</button>
          <button type="submit" class="submit-button" [disabled]="!chainForm.valid">Add Chain</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .add-chain-container {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    h3 {
      margin-top: 0;
      margin-bottom: 20px;
      color: #333;
    }

    .form-group {
      margin-bottom: 15px;
    }

    label {
      display: block;
      margin-bottom: 5px;
      color: #666;
      font-size: 14px;
    }

    input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.3s;
    }

    .submit-button {
      background-color: #007bff;
      color: white;
    }

    .submit-button:hover:not(:disabled) {
      background-color: #0056b3;
    }

    .submit-button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    .cancel-button {
      background-color: #6c757d;
      color: white;
    }

    .cancel-button:hover {
      background-color: #5a6268;
    }
  `]
})
export class AddChainComponent {
  @Output() chainAdded = new EventEmitter<EIP1193ProviderChain>();
  @Output() cancelled = new EventEmitter<void>();

  chainForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.chainForm = this.fb.group({
      chainName: ['', [Validators.required]],
      chainId: ['', [Validators.required, Validators.pattern(/^0x[0-9a-fA-F]+$/)]],
      rpcUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      currencyName: ['', [Validators.required]],
      currencySymbol: ['', [Validators.required]],
      blockExplorerUrl: ['', [Validators.pattern(/^https?:\/\/.+$/)]]
    });
  }

  onSubmit() {
    if (this.chainForm.valid) {
      const formValue = this.chainForm.value;
      const chain: EIP1193ProviderChain = {
        chainId: formValue.chainId,
        chainName: formValue.chainName,
        nativeCurrency: {
          name: formValue.currencyName,
          symbol: formValue.currencySymbol,
          decimals: 18
        },
        rpcUrls: [formValue.rpcUrl],
        blockExplorerUrls: formValue.blockExplorerUrl ? [formValue.blockExplorerUrl] : []
      };
      this.chainAdded.emit(chain);
    }
  }

  onCancel() {
    this.cancelled.emit();
  }
} 