import { Type } from '@angular/core';
import { WalletManagementPageComponent } from '../../flows/wallet-management/wallet-management-page/wallet-management-page.component';
import { SendPageComponent } from '../../flows/transaction/send-page/send-page.component';
import { SendKaspaComponent } from '../../flows/transaction/send-page/components/send-kaspa/send-kaspa.component';
import { SendKrc20ListComponent } from '../../flows/transaction/send-page/components/send-krc20-list/send-krc20-list.component';
import { SendKrc20Component } from '../../flows/transaction/send-page/components/send-krc20/send-krc20.component';
import { SendNftListComponent } from '../../flows/transaction/send-page/components/send-nft-list/send-nft-list.component';
import { SendNftComponent } from '../../flows/transaction/send-page/components/send-nft/send-nft.component';
import { SendKnsListComponent } from '../../flows/transaction/send-page/components/send-kns-list/send-kns-list.component';
import { SendKnsComponent } from '../../flows/transaction/send-page/components/send-kns/send-kns.component';
import { ApprovalFlowPageComponent } from '../../flows/approval/approval-flow-page/approval-flow-page.component';
import { ReceiveFlowPageComponent } from '../../flows/receive/receive-flow-page.component';
import { ExportWalletComponent } from '../../flows/export-wallet/export-wallet.component';
import { PlaceholderFlowPageComponent } from './placeholder-flow-page.component';
import { IFlowPageConfig } from './interfaces/flow-page.interface';

export type FlowPageRegistryEntry =
  | Type<unknown>
  | {
      component: Type<unknown>;
      getInputs?: (config: IFlowPageConfig | null) => Record<string, unknown>;
    };

export const FLOW_PAGE_IDS = [
  'wallet-management',
  'send',
  'send-kaspa',
  'send-krc20-list',
  'send-krc20',
  'send-nft-list',
  'send-nft',
  'send-kns-list',
  'send-kns',
  'action-approval',
  'receive',
  'export-wallet',
  'add-wallet',
  'create-wallet',
  'send-confirmation',
] as const;

export type FlowPageId = (typeof FLOW_PAGE_IDS)[number];

export const FLOW_PAGE_REGISTRY: Record<FlowPageId, FlowPageRegistryEntry> = {
  'wallet-management': WalletManagementPageComponent,
  send: SendPageComponent,
  'send-kaspa': SendKaspaComponent,
  'send-krc20-list': SendKrc20ListComponent,
  'send-krc20': SendKrc20Component,
  'send-nft-list': SendNftListComponent,
  'send-nft': SendNftComponent,
  'send-kns-list': SendKnsListComponent,
  'send-kns': SendKnsComponent,
  'action-approval': ApprovalFlowPageComponent,
  receive: ReceiveFlowPageComponent,
  'export-wallet': ExportWalletComponent,

  // Placeholders
  'add-wallet': {
    component: PlaceholderFlowPageComponent,
    getInputs: () => ({ text: 'Add Wallet page - Coming soon' }),
  },
  'create-wallet': {
    component: PlaceholderFlowPageComponent,
    getInputs: () => ({ text: 'Create Wallet page - Coming soon' }),
  },
  'send-confirmation': {
    component: PlaceholderFlowPageComponent,
    getInputs: () => ({ text: 'Send Confirmation page - Coming soon' }),
  },
} as const;
