import { Type, InputSignal, OutputEmitterRef } from '@angular/core';
import { CreateWalletAccountQuickActionDialogComponent } from './implementations/create-wallet-account/create-wallet-account-quick-action-dialog.component';
import { EditWalletQuickActionDialogComponent } from './implementations/edit-wallet/edit-wallet-quick-action-dialog.component';
import { DeleteWalletAccountQuickActionDialogComponent } from './implementations/delete-wallet-account/delete-wallet-account-quick-action-dialog.component';
import { WalletOptionsQuickActionDialogComponent } from './implementations/wallet-options/wallet-options-quick-action-dialog.component';
import { DeleteWalletQuickActionDialogComponent } from './implementations/delete-wallet/delete-wallet-quick-action-dialog.component';

export interface IQuickActionDialogComponent {
  isOpen: InputSignal<boolean>;
  data: InputSignal<any>;
  backdropClick: OutputEmitterRef<void>;
  close: OutputEmitterRef<void>;
}

export type QuickActionDialogRegistryEntry = Type<IQuickActionDialogComponent>;

export const QUICK_ACTION_DIALOG_IDS = [
  'add-account',
  'edit-account',
  'edit-wallet',
  'delete-account',
  'wallet-options',
  'delete-wallet',
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
  'delete-wallet': DeleteWalletQuickActionDialogComponent,
} as const;
