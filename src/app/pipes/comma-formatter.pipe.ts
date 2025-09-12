import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'commaFormatter',
  standalone: true,
})
export class CommaFormatterPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return '0';
    }

    // Format with commas and appropriate decimal places
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8
    });
  }
} 