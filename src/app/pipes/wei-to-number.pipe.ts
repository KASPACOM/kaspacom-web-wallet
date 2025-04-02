import { Pipe, PipeTransform } from '@angular/core';
import { ethers } from 'ethers';

@Pipe({
  name: 'weiToNumber',
  standalone: true,
})
export class WeiToNumberPipe implements PipeTransform {
  constructor(
  ) {}

  transform(value: string | number | bigint, ...args: unknown[]): unknown {
    return ethers.formatEther(value);
  }
}
