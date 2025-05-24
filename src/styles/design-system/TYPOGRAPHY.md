# Typography System

This document outlines the comprehensive typography system used across the application.

## Base Font Classes

These classes control the font weight and style without specifying size or line height.

| Class | Font Weight | Style |
|-------|------------|-------|
| `.thin` | 100 | normal |
| `.extralight` | 200 | normal |
| `.light` | 300 | normal |
| `.regular` | 400 | normal |
| `.medium` | 500 | normal |
| `.semibold` | 600 | normal |
| `.bold` | 700 | normal |
| `.extrabold` | 800 | normal |
| `.black` | 900 | normal |
| `.thin-italic` | 100 | italic |
| `.extralight-italic` | 200 | italic |
| `.light-italic` | 300 | italic |
| `.regular-italic` | 400 | italic |
| `.medium-italic` | 500 | italic |
| `.semibold-italic` | 600 | italic |
| `.bold-italic` | 700 | italic |
| `.extrabold-italic` | 800 | italic |
| `.black-italic` | 900 | italic |

## Typography System

### Title Series

Semibold text with increasing sizes. Use for headings and emphasized text.

| Class | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|------------|
| `.typo-title-1` | 0.875rem (14px) | 1.4 | 600 |
| `.typo-title-2` | 1rem (16px) | 1.4 | 600 |
| `.typo-title-3` | 1.25rem (20px) | 1.375 | 600 |
| `.typo-title-4` | 1.5rem (24px) | 1.375 | 600 |
| `.typo-title-5` | 2rem (32px) | 1.3 | 600 |
| `.typo-title-6` | 2.5rem (40px) | 1.2 | 600 |

### Text Series

Regular text with increasing sizes. Use for body text.

| Class | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|------------|
| `.typo-text-1` | 0.75rem (12px) | 1.5 | 400 |
| `.typo-text-2` | 0.875rem (14px) | 1.5 | 400 |
| `.typo-text-3` | 1rem (16px) | 1.5 | 400 |
| `.typo-text-4` | 1.125rem (18px) | 1.5 | 400 |
| `.typo-text-5` | 1.25rem (20px) | 1.5 | 400 |
| `.typo-text-6` | 1.5rem (24px) | 1.5 | 400 |

### Headers

Bolder, larger text for main page headers.

| Class | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|------------|
| `.typo-header-1` | 3rem (48px) | 1.2 | 700 |
| `.typo-header-2` | 2.25rem (36px) | 1.2 | 700 |

### Captions

Small text for UI captions, explanatory text, and meta information.

| Class | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|------------|
| `.typo-caption` | 0.75rem (12px) | 1.4 | 400 |
| `.typo-caption-semibold` | 0.75rem (12px) | 1.4 | 600 |

### Labels

Text for form labels and similar UI elements.

| Class | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|------------|
| `.typo-label` | 0.8125rem (13px) | 1.4 | 500 |

### Button Text

Specific typography optimized for buttons.

| Class | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|------------|
| `.typo-button-small` | 0.75rem (12px) | 1.2 | 600 |
| `.typo-button-medium` | 0.875rem (14px) | 1.2 | 600 |
| `.typo-button-large` | 1rem (16px) | 1.2 | 600 |

### UI Elements

Typography for specific UI elements.

| Class | Font Size | Line Height | Font Weight | Notes |
|-------|-----------|-------------|------------|-------|
| `.typo-ui-overline` | 0.6875rem (11px) | 1.2 | 600 | Uppercase |
| `.typo-ui-badge` | 0.625rem (10px) | 1 | 600 | For badges |

### Miscellaneous

Other useful typography classes.

| Class | Font Size | Line Height | Font Weight | Notes |
|-------|-----------|-------------|------------|-------|
| `.typo-link` | Inherited | Inherited | 500 | Underlined |
| `.typo-quote` | 1.125rem (18px) | 1.6 | 400 | Italic |

### Responsive Typography

Flexible typography that adjusts based on viewport size.

| Class | Font Size | Line Height | Font Weight | Notes |
|-------|-----------|-------------|------------|-------|
| `.typo-responsive-title` | clamp(1.25rem, 5vw, 2.5rem) | 1.3 | 600 | Responsive |
| `.typo-responsive-text` | clamp(0.875rem, 3vw, 1.125rem) | 1.5 | 400 | Responsive |

## Usage with Components

The typography system integrates with our component library. Component size properties typically map to typography classes as follows:

### Buttons

| Component Size | Typography Class |
|----------------|------------------|
| XS | `.typo-button-small` |
| SM | `.typo-button-small` |
| MD | `.typo-button-medium` |
| LG | `.typo-button-large` |
| XLG | `.typo-button-large` |

### Dropdown Selects

| Component Size | Typography Class |
|----------------|------------------|
| XS | `.typo-text-1` |
| SM | `.typo-text-2` |
| MD | `.typo-text-3` |
| LG | `.typo-text-4` |
| XLG | `.typo-text-5` |

Dropdown options use `.typo-text-3` regardless of dropdown size.

## Usage Examples

```html
<!-- For a main page heading -->
<h1 class="typo-header-1">Welcome to Our Application</h1>

<!-- For a section heading -->
<h2 class="typo-title-4">Features Overview</h2>

<!-- For body text -->
<p class="typo-text-3">This is the main content of our application.</p>

<!-- For a small caption -->
<span class="typo-caption">Last updated: Yesterday</span>

<!-- For responsive text -->
<h1 class="typo-responsive-title">This heading adjusts to viewport size</h1>
```

When combined with components that automatically apply typography classes:

```html
<!-- Button with size-appropriate typography -->
<app-button [size]="ComponentSize.LG" text="Get Started"></app-button>

<!-- Dropdown with size-appropriate typography -->
<app-dropdown-select [size]="ComponentSize.MD" [options]="options"></app-dropdown-select>
``` 
