import { Type } from '@angular/core';
import { WalletManagementPageComponent } from '../../flows/wallet-management/wallet-management-page/wallet-management-page.component';
import { SendPageComponent } from '../../flows/transaction/send-page/send-page.component';
import { SendKaspaComponent } from '../../flows/transaction/send-page/components/send-asset/l1/send-kaspa/send-kaspa.component';
import { SendKrc20ListComponent } from '../../flows/transaction/send-page/components/send-asset/l1/send-krc20-list/send-krc20-list.component';
import { SendKrc20Component } from '../../flows/transaction/send-page/components/send-asset/l1/send-krc20/send-krc20.component';
import { SendNftListComponent } from '../../flows/transaction/send-page/components/send-asset/l1/send-nft-list/send-nft-list.component';
import { SendNftComponent } from '../../flows/transaction/send-page/components/send-asset/l1/send-nft/send-nft.component';
import { SendKnsListComponent } from '../../flows/transaction/send-page/components/send-asset/l1/send-kns-list/send-kns-list.component';
import { SendKnsComponent } from '../../flows/transaction/send-page/components/send-asset/l1/send-kns/send-kns.component';
import { SendL2KaspaComponent } from '../../flows/transaction/send-page/components/send-asset/l2/send-l2-kaspa/send-l2-kaspa.component';
import { SendL2Erc20ListComponent } from '../../flows/transaction/send-page/components/send-asset/l2/send-l2-erc20-list/send-l2-erc20-list.component';
import { ApprovalFlowPageComponent } from '../../flows/approval/approval-flow-page/approval-flow-page.component';
import { ReceiveFlowPageComponent } from '../../flows/receive/receive-flow-page.component';
import { ExportWalletComponent } from '../../flows/export-wallet/export-wallet.component';
import { ExportAccountComponent } from '../../flows/export-account/export-account.component';
import { PlaceholderFlowPageComponent } from './placeholder-flow-page.component';
import { ImportExistingFlowComponent } from '../../../onboarding-page/flows/import-existing-flow/import-existing-flow.component';
import { NewWalletFlowComponent } from '../../../onboarding-page/flows/new-wallet-flow/new-wallet-flow.component';
import { WalletSelectionPageComponent } from '../../flows/wallet-selection/wallet-selection-page.component';
import { SettingsMenuComponent } from '../../flows/settings/settings-menu.component';
import { DeleteWalletConfirmationComponent } from '../../flows/settings/delete-wallet-confirmation.component';
import { ExportKaspacomWalletFlowPageComponent } from '../../flows/export-kaspacom-wallet/export-kaspacom-wallet-flow-page.component';
import { IFlowPageConfig } from './interfaces/flow-page.interface';
import { NetworkSelectionModalComponent } from '../../../../shared/network-selection-modal/network-selection-modal.component';
import { SendErc20Component } from '../../flows/transaction/send-page/components/send-asset/l2/send-erc20/send-erc20.component';
import { SwapFlowPageComponent } from '../../flows/swap/swap-flow-page.component';
import { ImportTokenFlowPageComponent } from '../../flows/import-token/import-token-flow-page.component';

export type FlowPageRegistryEntry =
  | Type<unknown>
  | {
    component: Type<unknown>;
    getInputs?: (config: IFlowPageConfig | null) => Record<string, unknown>;
  };

export const FLOW_PAGE_IDS = [
  'wallet-management',
  'wallet-selection',
  'send',
  'send-kaspa',
  'send-krc20-list',
  'send-krc20',
  'send-nft-list',
  'send-nft',
  'send-kns-list',
  'send-kns',
  'send-l2-kaspa',
  'send-l2-erc20-list',
  'send-erc20',
  'action-approval',
  'receive',
  'export-account',
  'export-wallet',
  'export-kaspacom-wallet',
  'add-wallet',
  'create-wallet',
  'send-confirmation',
  'settings-menu',
  'delete-wallet-confirmation',

  'network-selection',
  'swap',
  'import-token',
] as const;

export type FlowPageId = (typeof FLOW_PAGE_IDS)[number];

export const FLOW_PAGE_REGISTRY: Record<FlowPageId, FlowPageRegistryEntry> = {
  'wallet-management': WalletManagementPageComponent,
  'wallet-selection': WalletSelectionPageComponent,
  send: SendPageComponent,
  'send-kaspa': SendKaspaComponent,
  'send-krc20-list': SendKrc20ListComponent,
  'send-krc20': SendKrc20Component,
  'send-nft-list': SendNftListComponent,
  'send-nft': SendNftComponent,
  'send-kns-list': SendKnsListComponent,
  'send-kns': SendKnsComponent,
  'send-l2-kaspa': SendL2KaspaComponent,
  'send-l2-erc20-list': SendL2Erc20ListComponent,
  'send-erc20': SendErc20Component,
  'action-approval': ApprovalFlowPageComponent,
  receive: ReceiveFlowPageComponent,
  'export-account': ExportAccountComponent,
  'export-wallet': ExportWalletComponent,
  'export-kaspacom-wallet': ExportKaspacomWalletFlowPageComponent,
  'add-wallet': {
    component: ImportExistingFlowComponent,
    getInputs: () => ({ skipPassword: true }),
  },
  'create-wallet': {
    component: NewWalletFlowComponent,
    getInputs: () => ({ skipPassword: true }),
  },
  'send-confirmation': {
    component: PlaceholderFlowPageComponent,
    getInputs: () => ({ text: 'Send Confirmation page - Coming soon' }),
  },
  'settings-menu': SettingsMenuComponent,
  'delete-wallet-confirmation': DeleteWalletConfirmationComponent,
  'network-selection': NetworkSelectionModalComponent,
  'swap': SwapFlowPageComponent,
  'import-token': ImportTokenFlowPageComponent,
} as const;
