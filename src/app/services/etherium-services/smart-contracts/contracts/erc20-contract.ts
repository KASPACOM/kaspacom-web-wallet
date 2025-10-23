import { Injectable } from '@angular/core';

import ERC20ABI from '../abis/ERC20.json';
import { BaseContract } from './base-contract';
import { ethers } from 'ethers';
import { WalletActionResultWithError } from '../../../../types/wallet-action-result';
import { WalletActionService } from '../../../wallet-action.service';
import { WalletService } from '../../../wallet.service';

export class ERC20Contract extends BaseContract {
  static getContract(walletService: WalletService, walletActionService: WalletActionService, address: string): ERC20Contract {
    return new ERC20Contract(walletService, walletActionService, address);
  }

  constructor(
    walletService: WalletService,
    walletActionService: WalletActionService,
    address: string,
  ) {
    super(walletService, walletActionService, address, ERC20ABI);
  }

  async totalSupply(): Promise<ethers.BigNumberish> {
    return await this.callViewMethod<ethers.BigNumberish>('totalSupply');
  }

  async balanceOf(owner: string): Promise<ethers.BigNumberish> {
    return await this.callViewMethod<ethers.BigNumberish>('balanceOf', owner);
  }

  async transfer(to: string, value: string): Promise<WalletActionResultWithError> {
    return await this.doContractAction('transfer', to, value);
  }

  async approve(spender: string, value: string): Promise<WalletActionResultWithError> {
    return await this.doContractAction('approve', spender, value);
  }

  async allowance(
    owner: string,
    spender: string,
  ): Promise<ethers.BigNumberish | bigint> {
    return await this.callViewMethod<ethers.BigNumberish>(
      'allowance',
      owner,
      spender,
    );
  }

  async transferFrom(from: string, to: string, value: string): Promise<WalletActionResultWithError> {
    return await this.doContractAction('transferFrom', from, to, value);
  }

  async name(): Promise<string> {
    return await this.callViewMethod<string>('name');
  }

  async symbol(): Promise<string> {
    return await this.callViewMethod<string>('symbol');
  }

  // async decimals(): Promise<number> {
  //   if (this.decimalsCache === undefined) {
  //     this.decimalsCache = await (this.callViewMethod(
  //       'decimals',
  //     ) as Promise<number>);
  //   }
  //   return this.decimalsCache;
  // }

  async decimals(): Promise<bigint> {
    return await this.callViewMethod<bigint>('decimals');
  }
}
