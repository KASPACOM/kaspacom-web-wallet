import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent } from '@kaspacom/ui-kit';

type ButtonSize = 's' | 'm' | 'l' | 'xl' | 'xs';
type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonExample {
  title: string;
  text?: string;
  prefixIcon?: string;
  suffixIcon?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  width?: string;
  size: ButtonSize;
  variant: ButtonVariant;
}

@Component({
  selector: 'app-button-showcase',
  standalone: true,
  imports: [CommonModule, KcButtonComponent],
  templateUrl: './button-showcase.component.html',
  styleUrls: ['./button-showcase.component.scss']
})
export class ButtonShowcaseComponent {
  variants: ButtonVariant[] = ['primary', 'secondary', 'tertiary'];
  sizes: ButtonSize[] = ['s', 'm'];
  
  buttonExamples: ButtonExample[] = [
    // Primary buttons
    { title: 'Primary Default', text: 'Click me', size: 'm', variant: 'primary' },
    { title: 'Primary Small', text: 'Small button', size: 's', variant: 'primary' },
    { title: 'Primary with Icons', text: 'Send', prefixIcon: 'icon-send', suffixIcon: 'icon-arrow-right', size: 'm', variant: 'primary' },
    { title: 'Primary Loading', text: 'Submit', loading: true, loadingText: 'Submitting...', size: 'm', variant: 'primary' },
    { title: 'Primary Disabled', text: 'Disabled', disabled: true, size: 'm', variant: 'primary' },
    { title: 'Primary Full Width', text: 'Full Width Button', fullWidth: true, size: 'm', variant: 'primary' },
    { title: 'Primary Fixed Width', text: 'Fixed Width', width: '200px', size: 'm', variant: 'primary' },
    
    // Secondary buttons
    { title: 'Secondary Default', text: 'Click me', size: 'm', variant: 'secondary' },
    { title: 'Secondary Small', text: 'Small button', size: 's', variant: 'secondary' },
    { title: 'Secondary with Icons', text: 'Upload', prefixIcon: 'icon-upload', suffixIcon: 'icon-cloud', size: 'm', variant: 'secondary' },
    { title: 'Secondary Loading', text: 'Processing', loading: true, loadingText: 'Processing...', size: 'm', variant: 'secondary' },
    { title: 'Secondary Disabled', text: 'Disabled', disabled: true, size: 'm', variant: 'secondary' },
    
    // Tertiary buttons
    { title: 'Tertiary Default', text: 'Click me', size: 'm', variant: 'tertiary' },
    { title: 'Tertiary Small', text: 'Small button', size: 's', variant: 'tertiary' },
    { title: 'Tertiary with Icons', text: 'Settings', prefixIcon: 'icon-settings', size: 'm', variant: 'tertiary' },
    { title: 'Tertiary Loading', text: 'Loading', loading: true, size: 'm', variant: 'tertiary' },
    { title: 'Tertiary Disabled', text: 'Disabled', disabled: true, size: 'm', variant: 'tertiary' },
  ];
  
  stateExamples = {
    primary: [
      { state: 'Normal', text: 'Normal State', size: 'm' as ButtonSize, variant: 'primary' as ButtonVariant },
      { state: 'Hover', text: 'Hover State', size: 'm' as ButtonSize, variant: 'primary' as ButtonVariant, class: 'hover-example' },
      { state: 'Active', text: 'Active State', size: 'm' as ButtonSize, variant: 'primary' as ButtonVariant, class: 'active-example' },
      { state: 'Loading', text: 'Loading', loading: true, size: 'm' as ButtonSize, variant: 'primary' as ButtonVariant },
      { state: 'Disabled', text: 'Disabled', disabled: true, size: 'm' as ButtonSize, variant: 'primary' as ButtonVariant },
    ],
    secondary: [
      { state: 'Normal', text: 'Normal State', size: 'm' as ButtonSize, variant: 'secondary' as ButtonVariant },
      { state: 'Hover', text: 'Hover State', size: 'm' as ButtonSize, variant: 'secondary' as ButtonVariant, class: 'hover-example' },
      { state: 'Active', text: 'Active State', size: 'm' as ButtonSize, variant: 'secondary' as ButtonVariant, class: 'active-example' },
      { state: 'Loading', text: 'Loading', loading: true, size: 'm' as ButtonSize, variant: 'secondary' as ButtonVariant },
      { state: 'Disabled', text: 'Disabled', disabled: true, size: 'm' as ButtonSize, variant: 'secondary' as ButtonVariant },
    ],
    tertiary: [
      { state: 'Normal', text: 'Normal State', size: 'm' as ButtonSize, variant: 'tertiary' as ButtonVariant },
      { state: 'Hover', text: 'Hover State', size: 'm' as ButtonSize, variant: 'tertiary' as ButtonVariant, class: 'hover-example' },
      { state: 'Active', text: 'Active State', size: 'm' as ButtonSize, variant: 'tertiary' as ButtonVariant, class: 'active-example' },
      { state: 'Loading', text: 'Loading', loading: true, size: 'm' as ButtonSize, variant: 'tertiary' as ButtonVariant },
      { state: 'Disabled', text: 'Disabled', disabled: true, size: 'm' as ButtonSize, variant: 'tertiary' as ButtonVariant },
    ]
  };
  
  clickCount = 0;
  lastClickedButton = '';
  
  handleButtonClick(event: MouseEvent, buttonTitle: string): void {
    this.clickCount++;
    this.lastClickedButton = buttonTitle;
    console.log('Button clicked:', buttonTitle, event);
  }
}

