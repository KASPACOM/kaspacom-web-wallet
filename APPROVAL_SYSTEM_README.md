# Flexible Approval System

This document explains the new flexible approval system that supports multiple display modes for wallet action approvals.

## Overview

The new approval system provides three rendering modes:

1. **Flow Page Mode** - For regular app usage, integrated with the flow page system
2. **Modal Dialog Mode** - For iframe usage, displays as a modal overlay
3. **Full Page Mode** - For legacy/route-based usage (fallback)

## Architecture

### Core Components

1. **`ApprovalFlowService`** - Manages approval flow logic and display mode selection
2. **`ApprovalFlowPageComponent`** - Flow-optimized approval UI component
3. **`ReviewActionComponent`** - Legacy approval component (still used for iframe mode)
4. **`WalletActionService`** - Updated to use the new approval system

### How It Works

```typescript
// In WalletActionService.showApprovalDialogToUser()
if (!isFromIframe) {
  // Use new flow-based approval system
  return await this.approvalFlowService.showApproval(action, isFromIframe);
} else {
  // Use legacy modal/route-based system
  // ... existing logic
}
```

## Display Modes

### 1. Flow Page Mode (`ApprovalDisplayMode.FLOW_PAGE`)

**When:** Regular app usage in v2 context (`/app/*` routes, not iframe)
**Design:** Integrated into the flow page system with modern UI
**Benefits:**
- Consistent with app flow navigation
- Modern design matching the v2 UI
- Better UX with proper back navigation
- Optimized for wallet app context

### 2. Modal Dialog Mode (`ApprovalDisplayMode.MODAL_DIALOG`)

**When:** Iframe usage or legacy contexts
**Design:** Modal overlay with backdrop
**Benefits:**
- Maintains current iframe functionality
- Full-screen overlay for focused attention
- Compatible with existing iframe integration

### 3. Full Page Mode (`ApprovalDisplayMode.FULL_PAGE`)

**When:** Fallback for route-based navigation
**Design:** Full page via router navigation
**Benefits:**
- Backward compatibility
- Route-based navigation support

## Key Features

### Automatic Mode Selection

The system automatically selects the appropriate display mode based on context:

```typescript
private determineDisplayMode(isFromIframe: boolean): ApprovalDisplayMode {
  if (isFromIframe) {
    return ApprovalDisplayMode.MODAL_DIALOG;
  }
  // For regular app usage, use flow pages
  return ApprovalDisplayMode.FLOW_PAGE;
}
```

### Consistent API

All modes use the same promise-based API:

```typescript
const result = await approvalFlowService.showApproval(action, isFromIframe);
// result: { isApproved: boolean; priorityFee?: bigint; additionalParams?: {...} }
```

### Flow Integration

The flow page mode integrates seamlessly with the existing flow system:

```typescript
// Opens approval as a flow page
this.flowPagesService.openFlow({
  id: 'action-approval',
  title: this.getApprovalTitle(config.action),
  canNavigateBack: true
});
```

## Design Differences

### Flow Page Design
- Modern, clean interface optimized for wallet flows
- Integrated header with flow navigation
- Consistent with v2 design system
- Responsive layout
- Proper scrolling for long content

### Modal Dialog Design  
- Full-screen overlay with backdrop
- Centered modal container
- Compatible with iframe constraints
- Fixed positioning

## Usage Examples

### For New V2 App Features

```typescript
// In a component that needs approval
const result = await this.walletActionService.validateAndDoActionAfterApproval(
  action,
  false // isFromIframe = false, will use flow page mode
);
```

### For Iframe Integration

```typescript
// Iframe communication handler
const result = await this.walletActionService.validateAndDoActionAfterApproval(
  action,
  true // isFromIframe = true, will use modal dialog mode
);
```

## Benefits

1. **Flexible UX** - Different experiences for different contexts
2. **Better Integration** - Flow pages integrate better with app navigation
3. **Backward Compatibility** - Existing iframe functionality preserved
4. **Consistent API** - Same service interface for all modes
5. **Modern Design** - Flow page mode uses updated design system
6. **Better Performance** - No unnecessary route navigation for regular usage

## Migration

The new system is automatically enabled for v2 app contexts. No changes needed for:
- Existing iframe integrations (continue using modal dialog mode)
- Legacy route-based implementations (fallback to full page mode)

New v2 features automatically benefit from the improved flow page mode. 