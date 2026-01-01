import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortenAddress',
  standalone: true,
})
export class ShortenAddressPipe implements PipeTransform {
  /**
   * Shortens a blockchain address for display
   * @param address The full address to shorten
   * @param frontChars Number of characters to show at the start (default: 10)
   * @param backChars Number of characters to show at the end (default: 8)
   * @returns Shortened address in format: "kaspatest:...xwpd4mc5"
   */
  transform(
    address: string | null | undefined,
    frontChars: number = 10,
    backChars: number = 8,
  ): string {
    if (!address) return '';
    if (address.length <= frontChars + backChars) return address;
    return `${address.slice(0, frontChars)}...${address.slice(-backChars)}`;
  }
}
