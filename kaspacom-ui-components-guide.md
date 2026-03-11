# Kaspacom UI Components Guide

## Overview

**kaspacom-ui** is an Angular UI Component Library for KaspaCom DeFi Applications. This guide provides comprehensive documentation for all available components, their properties, and usage examples.

**Version:** 1.1.3  
**Framework:** Angular 19.2.0+  
**Dependencies:** PrimeNG 19.0.0+, PrimeIcons 7.0.0+

## Installation

```bash
npm install kaspacom-ui --save
```

## Import Statement

```typescript
import {
  KcButtonComponent,
  KcInputComponent,
  KcCardComponent,
  // ... other components
} from "kaspacom-ui";
```

---

## Components Reference

### 1. Button Component (`kc-button`)

#### Properties

- **text**: `string` - Button text
- **variant**: `ButtonVariant` - Button style variant
  - Options: `'primary'` | `'secondary'` | `'tertiary'` | `'gradient_1'` | `'gradient_2'`
- **size**: `ComponentSize` - Button size
  - Options: `'xs'` | `'sm'` | `'md'` | `'lg'` | `'xlg'`
- **isLoading**: `boolean` - Shows loading spinner
- **isFullWidth**: `boolean` - Full width button
- **isDisabled**: `boolean` - Disabled state
- **role**: `'success'` | `'warning'` | `'info'` | `'neutral'` | `'danger'` | `null`
- **prefixIcon**: `string` - Icon before text
- **suffixIcon**: `string` - Icon after text
- **prefixIconColor**: `string` - Prefix icon color
- **suffixIconColor**: `string` - Suffix icon color
- **loadingText**: `string` - Text shown during loading

#### Events

- **buttonClick**: `MouseEvent` - Click event handler

#### Usage Example

```html
<kc-button text="Submit" variant="primary" size="md" [isLoading]="isSubmitting" prefixIcon="pi-check" (buttonClick)="handleSubmit($event)"> </kc-button>
```

---

### 2. Input Component (`kc-input`)

#### Properties

- **label**: `string` - Input label
- **placeholder**: `string` - Placeholder text
- **type**: `'text'` | `'password'` | `'number'` - Input type
- **isFullWidth**: `boolean` - Full width input
- **isDisabled**: `boolean` - Disabled state
- **isValid**: `boolean` - Validation state
- **invalidReason**: `string` - Error message
- **prepadInvalidReason**: `boolean` - Prepend validation message
- **prefixIcon**: `string` - Icon before input
- **suffixIcon**: `string` - Icon after input
- **prefixLabelIcon**: `string` - Icon before label
- **suffixLabelIcon**: `string` - Icon after label
- **min**: `number` - Minimum value (for number type)
- **max**: `number` - Maximum value (for number type)

#### Events

- **valueChange**: `any` - Value change event
- **blur**: `void` - Blur event
- **focus**: `void` - Focus event
- **keyup**: `KeyboardEvent` - Keyup event
- **keydown**: `KeyboardEvent` - Keydown event
- **validationChange**: `boolean` - Validation state change

#### Usage Example

```html
<kc-input label="Email Address" placeholder="Enter your email" type="text" prefixIcon="pi-envelope" [isValid]="emailValid" invalidReason="Please enter a valid email" (valueChange)="onEmailChange($event)"> </kc-input>
```

---

### 3. Card Component (`kc-card`)

#### Properties

- **title**: `string` - Card title
- **showHeader**: `boolean` - Show header section
- **isClosable**: `boolean` - Show close button
- **showHeaderSeparator**: `boolean` - Show header separator
- **prefixIcon**: `string` - Icon in header
- **size**: `ComponentSize` - Card size
- **fullWidth**: `boolean` - Full width card
- **width**: `string` - Custom width
- **minWidth**: `string` - Minimum width
- **maxWidth**: `string` - Maximum width
- **maxHeight**: `string` - Maximum height

#### Content Projection

- **leftSlot**: Left side content
- **rightSlot**: Right side content
- **footerSlot**: Footer content

#### Usage Example

```html
<kc-card title="User Profile" [showHeader]="true" [isClosable]="true" prefixIcon="pi-user" size="md">
  <div>Card content goes here</div>

  <div footerSlot>
    <kc-button text="Save" variant="primary"></kc-button>
  </div>
</kc-card>
```

---

### 4. Dropdown Select Component (`kc-dropdown-select`)

#### Properties

- **options**: `DropdownOption[]` - Array of options
- **placeholder**: `string` - Placeholder text
- **size**: `ComponentSize` - Dropdown size
- **variant**: `DropdownVariant` - Style variant
- **isFullWidth**: `boolean` - Full width dropdown
- **isDisabled**: `boolean` - Disabled state
- **optionsEllipsis**: `boolean` - Truncate long options
- **isFullscreenSelection**: `boolean` - Fullscreen selection mode
- **icon**: `string` - Icon in dropdown
- **useContentWidth**: `boolean` - Use content width
- **maxWidth**: `string` - Maximum width
- **showToggleIcon**: `boolean` - Show toggle icon
- **isSearchable**: `boolean` - Enable search
- **searchField**: `string` - Search field

#### Events

- **valueChange**: `any` - Selection change event

#### Usage Example

```html
<kc-dropdown-select [options]="countryOptions" placeholder="Select country" size="md" [isSearchable]="true" (valueChange)="onCountrySelect($event)"> </kc-dropdown-select>
```

```typescript
// Component
countryOptions: DropdownOption[] = [
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
  { value: 'uk', label: 'United Kingdom' }
];
```

---

### 5. Checkbox Component (`kc-checkbox`)

#### Properties

- **label**: `string` - Checkbox label
- **size**: `ComponentSize` - Checkbox size
- **isDisabled**: `boolean` - Disabled state
- **isChecked**: `boolean` - Checked state

#### Events

- **checkedChange**: `boolean` - Check state change

#### Usage Example

```html
<kc-checkbox label="Accept Terms and Conditions" size="md" [isChecked]="termsAccepted" (checkedChange)="onTermsChange($event)"> </kc-checkbox>
```

---

### 6. Chip Component (`kc-chip`)

#### Properties

- **text**: `string` - Chip text
- **variant**: `ChipVariant` - Chip style
  - Options: `'success'` | `'error'` | `'warning'` | `'info'` | `'neutral'`
- **size**: `ComponentSize` - Chip size
- **prefixIcon**: `string` - Icon before text
- **suffixIcon**: `string` - Icon after text
- **prefixIconColor**: `string` - Prefix icon color
- **suffixIconColor**: `string` - Suffix icon color

#### Usage Example

```html
<kc-chip text="Active" variant="success" size="sm" prefixIcon="pi-check"> </kc-chip>
```

---

### 7. Icon Component (`kc-icon`)

#### Properties

- **iconClass**: `string` - Icon class name
- **size**: `ComponentSize` - Icon size
- **iconSize**: `ComponentSize` - Specific icon size
- **color**: `string` - Icon color
- **disabled**: `boolean` - Disabled state
- **classes**: `string` - Additional CSS classes
- **isDefaultColor**: `boolean` - Use default color

#### Usage Example

```html
<kc-icon iconClass="pi-home" size="md" color="#6FC7BA"> </kc-icon>
```

---

### 8. Spinner Component (`kc-spinner`)

#### Properties

- **size**: `ComponentSize` - Spinner size

#### Usage Example

```html
<kc-spinner size="md"></kc-spinner>
```

---

### 9. Base Modal Component (`kc-base-modal`)

#### Properties

- **title**: `string` - Modal title
- **showCloseButton**: `boolean` - Show close button
- **titleIconClass**: `string` - Title icon class
- **showHeaderSeperator**: `boolean` - Show header separator
- **autoWidth**: `boolean` - Auto width sizing

#### Events

- **close**: `void` - Close event

#### Usage Example

```html
<kc-base-modal title="Confirm Action" [showCloseButton]="true" titleIconClass="pi-exclamation-triangle" (close)="onModalClose()">
  <p>Are you sure you want to continue?</p>

  <div rightSideSlot>
    <kc-button text="Cancel" variant="secondary"></kc-button>
    <kc-button text="Confirm" variant="primary"></kc-button>
  </div>
</kc-base-modal>
```

---

### 10. Split Button Component (`kc-split-button`)

#### Properties

- **text**: `string` - Main button text
- **variant**: `ButtonVariant` - Button variant
- **size**: `ComponentSize` - Button size
- **isLoading**: `boolean` - Loading state
- **isFullWidth**: `boolean` - Full width button
- **isDisabled**: `boolean` - Disabled state
- **role**: `'success'` | `'warning'` | `'info'` | `'neutral'` | `'danger'` | `null`
- **prefixIcon**: `string` - Prefix icon
- **prefixIconColor**: `string` - Prefix icon color
- **toggleIconOpen**: `string` - Open state icon
- **toggleIconClosed**: `string` - Closed state icon
- **toggleIconColor**: `string` - Toggle icon color
- **loadingText**: `string` - Loading text
- **options**: `SplitButtonOption[]` - Menu options
- **isFullscreenMenu**: `boolean` - Fullscreen menu

#### Events

- **buttonClick**: `MouseEvent` - Main button click
- **optionClick**: `SplitButtonOption` - Menu option click

#### Usage Example

```html
<kc-split-button text="Save Document" variant="primary" size="md" [options]="saveOptions" (buttonClick)="onSave($event)" (optionClick)="onSaveOption($event)"> </kc-split-button>
```

---

### 11. Switch Navigation Component (`kc-switch-navigation`)

#### Properties

- **options**: `SwitchNavigationOption[]` - Navigation options
- **currentActive**: `string` - Current active option
- **disabled**: `boolean` - Disabled state
- **variant**: `SwitchNavigationVariant` - Style variant
- **size**: `ComponentSize` - Component size

#### Events

- **selectOption**: `string` - Option selection event

#### Usage Example

```html
<kc-switch-navigation [options]="navOptions" [currentActive]="activeTab" size="md" (selectOption)="onTabChange($event)"> </kc-switch-navigation>
```

---

### 12. Tooltip Directive (`kcTooltip`)

#### Properties

- **kcTooltip**: `string` - Tooltip text
- **tooltipTemplate**: `TemplateRef<any>` - Custom tooltip template
- **tooltipPosition**: `'top'` | `'bottom'` | `'left'` | `'right'` - Position
- **tooltipShowDelay**: `number` - Show delay (ms)
- **tooltipHideDelay**: `number` - Hide delay (ms)
- **tooltipTextColor**: `string` - Text color
- **tooltipPrefixIcon**: `string` - Prefix icon
- **tooltipSuffixIcon**: `string` - Suffix icon
- **tooltipPrefixIconColor**: `string` - Prefix icon color
- **tooltipSuffixIconColor**: `string` - Suffix icon color
- **tooltipActionable**: `boolean` - Interactive tooltip
- **tooltipActionableDebounce**: `number` - Debounce time

#### Usage Example

```html
<kc-button text="Hover me" kcTooltip="This is a helpful tooltip" tooltipPosition="top" tooltipShowDelay="500"> </kc-button>
```

---

### 13. Notification Service

#### Methods

- **success(title, description, duration?)**: Show success notification
- **error(title, description, duration?)**: Show error notification
- **warning(title, description, duration?)**: Show warning notification
- **info(title, description, duration?)**: Show info notification
- **neutral(title, description, duration?)**: Show neutral notification
- **clearAll()**: Clear all notifications
- **removeMessage(id)**: Remove specific notification
- **setConfig(config)**: Configure notification settings

#### Usage Example

```typescript
import { NotificationService } from 'kaspacom-ui';

constructor(private notificationService: NotificationService) {}

showSuccess() {
  this.notificationService.success(
    'Success!',
    'Operation completed successfully',
    5000
  );
}

showError() {
  this.notificationService.error(
    'Error!',
    'Something went wrong',
    0 // No auto-dismiss
  );
}
```

---

## Design System

### Color Palette

#### Primary Colors

- **Primary**: `#6FC7BA` (Kaspa-20)
- **Secondary**: `#B43AED` (Purple-20)
- **Tertiary**: `#595CFF` (Blue-20)
- **Background**: `#07090a` (Vampire Black)
- **Background Secondary**: `#0D1316`

#### Status Colors

- **Success**: `#3FC753` (Green-20)
- **Warning**: `#E6A223` (Orange-20)
- **Error**: `#E04242` (Red-20)
- **Info**: `#595CFF` (Blue-20)
- **Neutral**: `#9E9E9E` (Gray-60)

#### Gradients

- **Gradient 1**: `linear-gradient(90deg, #B43AED 0%, #FFD27D 44.23%, #A2FFF1 85.58%)`
- **Gradient 2**: `linear-gradient(90deg, #7477FF 0%, #595CFF 30%, #B43AED 70%, #D883FF 100%)`

### Typography

#### Font Family

- **Primary**: "Poppins", sans-serif

#### Typography Classes

- **Titles**: `.typo-title-1` to `.typo-title-6` (14px - 40px, semibold)
- **Text**: `.typo-text-1` to `.typo-text-6` (12px - 24px, regular)
- **Headers**: `.typo-header-1`, `.typo-header-2` (36px - 48px, bold)
- **Buttons**: `.typo-button-small`, `.typo-button-medium`, `.typo-button-large`
- **Captions**: `.typo-caption`, `.typo-caption-semibold`
- **Labels**: `.typo-label`

### Component Sizes

All components use the `ComponentSize` type:

- **xs**: Extra small
- **sm**: Small
- **md**: Medium (default)
- **lg**: Large
- **xlg**: Extra large

---

## Usage Tips

1. **Import Components**: Always import the specific components you need
2. **Form Integration**: Most form components implement `ControlValueAccessor`
3. **Responsive Design**: Use the responsive service for mobile-friendly layouts
4. **Theming**: Components automatically use the defined CSS variables
5. **Icons**: Use PrimeIcons class names for consistent iconography
6. **Accessibility**: Components include proper ARIA attributes and keyboard navigation

## Common Patterns

### Form with Validation

```html
<form [formGroup]="myForm">
  <kc-input label="Email" formControlName="email" [isValid]="myForm.get('email')?.valid || false" invalidReason="Please enter a valid email"> </kc-input>

  <kc-checkbox label="Newsletter" formControlName="newsletter"> </kc-checkbox>

  <kc-button text="Submit" variant="primary" [isDisabled]="myForm.invalid" (buttonClick)="onSubmit()"> </kc-button>
</form>
```

### Modal with Actions

```html
<kc-base-modal title="Delete Item" [showCloseButton]="true" (close)="closeModal()">
  <p>Are you sure you want to delete this item?</p>

  <div rightSideSlot>
    <kc-button text="Cancel" variant="secondary" (buttonClick)="closeModal()"> </kc-button>
    <kc-button text="Delete" variant="primary" role="danger" (buttonClick)="confirmDelete()"> </kc-button>
  </div>
</kc-base-modal>
```

---

This guide covers all the main components in the kaspacom-ui library. Refer to the individual component definitions for the most up-to-date properties and methods.
