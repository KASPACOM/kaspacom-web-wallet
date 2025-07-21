import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { FlowPageBaseComponent } from '../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../common/flow-page/interfaces/flow-page.interface';

interface WalletAccount {
  id: string;
  name: string;
  address: string;
  balance: number;
  isSelected: boolean;
}

@Component({
  selector: 'app-wallet-management-page',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './wallet-management-page.component.html',
  styleUrl: './wallet-management-page.component.scss'
})
export class WalletManagementPageComponent extends FlowPageBaseComponent {
  
  get config(): IFlowPageConfig {
    return {
      id: 'wallet-management',
      title: 'Manage accounts',
      canNavigateBack: false, // Explicitly disable back navigation
      canClose: true
    };
  }
  // Mock wallet data
  wallets = signal<WalletAccount[]>([
    {
      id: '1',
      name: 'Account 1',
      address: 'kaspa:qr0qs5y4hv8uc9ey6wqv5xmq8fakm2kxn9vg7msc8guu5d5vquqkqgh7vu5h4',
      balance: 1234.56,
      isSelected: true
    },
    {
      id: '2',
      name: 'Account 2',
      address: 'kaspa:qpamkvfgh8smy7d9eqgqua5hpc9xnt2w4yjmg9we9z0xpd5vyn2xqa58ch3az',
      balance: 5678.90,
      isSelected: false
    },
    {
      id: '3',
      name: 'Account 3',
      address: 'kaspa:qz3ty9xlkdrqwerty8wqpw8asdfg4hjkl2zxcvbn5mkjh8765fghyuiopqwer',
      balance: 987.65,
      isSelected: false
    },
    {
      id: '4',
      name: 'Account 4',
      address: 'kaspa:qr8asdfg8hjklzxcvbn4mkjh8wqpw8765fghyuiop2qwerty9xlkdrq3ty5za',
      balance: 3456.78,
      isSelected: false
    }
  ]);
  
  selectWallet(wallet: WalletAccount): void {
    this.wallets.update(wallets => 
      wallets.map(w => ({
        ...w,
        isSelected: w.id === wallet.id
      }))
    );
  }
  
  deleteWallet(wallet: WalletAccount): void {
    // Logic for deleting wallet would go here
    console.log('Delete wallet:', wallet.name);
  }
  
  addWallet(): void {
    // Navigate to add wallet page
    this.navigateToNextPage({
      id: 'add-wallet',
      title: 'Add Wallet',
      canNavigateBack: true
    });
  }
  
  createWallet(): void {
    // Navigate to create wallet page
    this.navigateToNextPage({
      id: 'create-wallet',
      title: 'Create Wallet',
      canNavigateBack: true
    });
  }
  
  manageWallets(): void {
    // Navigate to manage wallets functionality
    // You can implement the specific functionality here
    console.log('Manage wallets clicked');
    // For now, could navigate to add wallet page as an example
    this.navigateToNextPage({
      id: 'add-wallet',
      title: 'Add Wallet',
      canNavigateBack: true
    });
  }
  
  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }
}