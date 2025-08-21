import { Type, EventEmitter } from '@angular/core';
import { CreateWalletAccountQuickActionDialogComponent } from './implementations/create-wallet-account/create-wallet-account-quick-action-dialog.component';
import { EditWalletQuickActionDialogComponent } from './implementations/edit-wallet/edit-wallet-quick-action-dialog.component';
import { DeleteWalletAccountQuickActionDialogComponent } from './implementations/delete-wallet-account/delete-wallet-account-quick-action-dialog.component';
import { WalletOptionsQuickActionDialogComponent } from './implementations/wallet-options/wallet-options-quick-action-dialog.component';

export interface IQuickActionDialogComponent {
  isOpen: boolean;
  data: any;
  backdropClick: EventEmitter<void>;
  close: EventEmitter<void>;
}

export type QuickActionDialogRegistryEntry = Type<IQuickActionDialogComponent>;

export const QUICK_ACTION_DIALOG_IDS = [
  'add-account',
  'edit-account',
  'edit-wallet',
  'delete-account',
  'wallet-options',
] as const;

export type QuickActionDialogId = (typeof QUICK_ACTION_DIALOG_IDS)[number];

export const QUICK_ACTION_DIALOG_REGISTRY: Record<
  QuickActionDialogId,
  QuickActionDialogRegistryEntry
> = {
  'add-account': CreateWalletAccountQuickActionDialogComponent,
  'edit-account': CreateWalletAccountQuickActionDialogComponent,
  'edit-wallet': EditWalletQuickActionDialogComponent,
  'delete-account': DeleteWalletAccountQuickActionDialogComponent,
  'wallet-options': WalletOptionsQuickActionDialogComponent,
} as const;
