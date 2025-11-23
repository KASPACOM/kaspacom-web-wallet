# Iframe Account Selection Implementation

## Overview
This feature adds a blocking account selection experience when the wallet is used inside an iframe. After login, users must select an account or logout before the main app becomes interactive.

## Components Created/Modified

### New Files Created

1. **`src/app/v2/shared/wallet-list-view-model.service.ts`**
   - Shared service that provides wallet list view-model logic
   - Used by both the flow page and iframe account selection
   - Methods: `loadWalletGroups()`, `shortenAddress()`

2. **`src/app/v2/pages/app/iframe-account-selection/iframe-account-selection.component.ts`**
   - Standalone component for iframe account selection
   - Shows list of wallets/accounts
   - No create/import functionality
   - Has logout button
   - Emits `accountSelected` event when user picks an account

3. **`src/app/v2/pages/app/iframe-account-selection/iframe-account-selection.component.html`**
   - Full-screen overlay UI
   - Lists all wallets with selection state
   - Logout button at bottom

4. **`src/app/v2/pages/app/iframe-account-selection/iframe-account-selection.component.scss`**
   - Styled as blocking overlay with backdrop
   - Responsive design
   - Scrollable wallet list

5. **`src/app/v2/services/iframe-account-selection.service.ts`**
   - Manages overlay state
   - Methods: `openOverlay()`, `closeOverlay()`, `isOverlayOpen()`

### Modified Files

1. **`src/app/v2/pages/app/flows/wallet-selection/wallet-selection-page.component.ts`**
   - Refactored to use shared `WalletListViewModelService`
   - Removed duplicate wallet loading logic

2. **`src/app/v2/pages/app/app-wrapper.component.ts`**
   - Added `IframeAccountSelectionService` injection
   - Added `effect()` to watch for wallet selection state in iframe mode
   - When no wallet is selected in iframe mode, opens overlay
   - Added `onAccountSelected()` handler

3. **`src/app/v2/pages/app/app-wrapper.component.html`**
   - Added conditional rendering of `<app-iframe-account-selection>`
   - Shows when `isIframeMode() && iframeAccountSelectionService.isOverlayOpen()()`

4. **`src/app/v2/pages/onboarding-page-v2/onboarding-page-v2.component.ts`**
   - Updated `onSubmit()` to detect iframe mode
   - In iframe mode: deselects current wallet and opens overlay
   - In normal mode: auto-selects previously selected wallet

### Test Files Created

1. **`src/app/v2/services/iframe-account-selection.service.spec.ts`**
   - Tests overlay open/close functionality
   - Tests signal behavior

2. **`src/app/v2/pages/app/iframe-account-selection/iframe-account-selection.component.spec.ts`**
   - Tests component creation
   - Tests wallet loading
   - Tests address shortening

3. **`src/app/v2/shared/wallet-list-view-model.service.spec.ts`**
   - Tests wallet group loading
   - Tests address shortening logic

## User Flow

### Normal Web Mode (Non-Iframe)
1. User logs in via onboarding page
2. System loads wallets
3. System auto-selects previously selected wallet
4. User is navigated to `/app/home`
5. App is fully interactive

### Iframe Mode
1. User logs in via onboarding page
2. System loads wallets
3. System **clears** any wallet selection
4. System opens `IframeAccountSelectionService` overlay
5. User is navigated to `/app/home`
6. **Blocking overlay appears** showing all wallets/accounts
7. User must either:
   - **Select an account** → overlay closes, app becomes interactive
   - **Click logout** → returns to onboarding page
8. Once account is selected, wallet operations can proceed

### On Refresh (Iframe Mode)
1. If no wallet is selected, overlay auto-opens via `effect()` in `AppWrapperComponent`
2. User must select account again
3. Overlay closes when selection is made

## Key Behaviors

- **Cannot close overlay**: No close button, no backdrop click dismissal
- **Cannot create/import**: Only existing wallets shown, no add buttons
- **Must select or logout**: User cannot proceed without action
- **Persists across navigation**: Effect watches wallet signal continuously

## Testing Checklist

### Manual Testing

- [ ] **Normal Web Mode**
  - [ ] Login selects previous wallet automatically
  - [ ] No overlay appears
  - [ ] App is immediately interactive

- [ ] **Iframe Mode - First Login**
  - [ ] Login shows account selection overlay
  - [ ] Overlay blocks interaction with app
  - [ ] All wallets are displayed correctly
  - [ ] Can select a wallet → overlay closes
  - [ ] App becomes interactive after selection

- [ ] **Iframe Mode - Logout**
  - [ ] Clicking logout button works
  - [ ] Returns to onboarding page
  - [ ] Can login again

- [ ] **Iframe Mode - Refresh**
  - [ ] If no wallet selected, overlay appears
  - [ ] Must select wallet again
  - [ ] Selection persists within session

### Debugging Outside Iframe

To manually force the account selection overlay in a normal browser tab, run the following in DevTools **before logging in**:

```javascript
localStorage.setItem('KC_FORCE_ACCOUNT_SELECTION', 'true');
```

To disable the forced mode:

```javascript
localStorage.removeItem('KC_FORCE_ACCOUNT_SELECTION');
```

- [ ] **Visual/UI**
  - [ ] Overlay has proper backdrop
  - [ ] Wallet list scrolls if many wallets
  - [ ] Selected wallet is visually indicated
  - [ ] Logout button is styled correctly
  - [ ] Addresses are shortened properly

### Unit Testing

Run tests with:
```bash
npm test
```

All new test files should pass:
- `iframe-account-selection.service.spec.ts`
- `iframe-account-selection.component.spec.ts`
- `wallet-list-view-model.service.spec.ts`

## Architecture Decisions

1. **Reusable View Model**: Extracted wallet list logic into shared service to avoid duplication
2. **Signal-based State**: Used Angular signals for reactive state management
3. **Effect for Auto-open**: Used `effect()` to automatically detect when overlay should open
4. **Standalone Components**: All new components are standalone for better tree-shaking
5. **Service-based Overlay**: Overlay state managed by service for better separation of concerns

## Future Enhancements

- Add animation transitions for overlay open/close
- Add keyboard navigation support
- Add search/filter for many wallets
- Add account creation from overlay (if needed)
- Add "remember selection" option for iframe mode

