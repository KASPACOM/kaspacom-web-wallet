import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WeiToNumberPipe } from '../../../pipes/wei-to-number.pipe';
import { WalletActionService } from '../../../services/wallet-action.service';
import { WalletService } from '../../../services/wallet.service';
import { TransactionRequest, parseEther } from 'ethers';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'l2-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, WeiToNumberPipe],
  templateUrl: './l2-transaction.component.html',
  styleUrls: ['./l2-transaction.component.scss']
})
export class L2TransactionComponent implements OnInit {
  ethForm: FormGroup;

  constructor(private fb: FormBuilder, private walletActionService: WalletActionService, private walletService: WalletService) {
    this.ethForm = this.fb.group({
      to: ['', [Validators.pattern(/^0x[a-fA-F0-9]{40}$/)]],
      value: ['', [Validators.min(0)]],
      gasLimit: ['21000', [Validators.min(21000)]],
      gasPrice: ['', [Validators.min(0)]],
      data: [''],
      nonce: [''],
      sendToL1: [false]
    });
  }

  ngOnInit() { }

  async onSubmit() {
    if (this.ethForm.valid) {
      // Create a new object with only non-empty values
      const formData = { ...this.ethForm.value };
      const cleanData: TransactionRequest = {};

      // Process each field and convert value to wei if present
      if (formData.to) cleanData.to = formData.to;
      if (formData.value) cleanData.value = parseEther(String(formData.value)).toString();
      if (formData.gasLimit) cleanData.gasLimit = formData.gasLimit;
      if (formData.gasPrice) cleanData.gasPrice = formData.gasPrice;
      if (formData.data) cleanData.data = formData.data;
      if (formData.nonce) cleanData.nonce = formData.nonce;

      const action = this.walletActionService.createSignL2EtherTransactionAction(
        cleanData, 
        environment.l2Configs.kasplex.l1PayloadPrefix,
        true,
        formData.sendToL1, 
      );

      const result = await this.walletActionService.validateAndDoActionAfterApproval(action);
      console.log('Submit l2 ether transaction result', result);
    }
  }
} 