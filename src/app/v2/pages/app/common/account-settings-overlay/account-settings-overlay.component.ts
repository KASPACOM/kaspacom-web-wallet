import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KcButtonComponent, KcIconComponent } from '@kaspacom/ui';
import { trigger, state, style, transition, animate } from '@angular/animations';

interface WalletAccount {
  id: string;
  name: string;
  address: string;
  balance: number;
  isSelected: boolean;
}

@Component({
  selector: 'app-account-settings-overlay',
  standalone: true,
  imports: [CommonModule, KcButtonComponent, KcIconComponent],
  templateUrl: './account-settings-overlay.component.html',
  styleUrl: './account-settings-overlay.component.scss',
  animations: [
    trigger('slideDown', [
      state('closed', style({
        transform: 'translateY(-100%)',
        opacity: 0,
        visibility: 'hidden'
      })),
      state('open', style({
        transform: 'translateY(0)',
        opacity: 1,
        visibility: 'visible'
      })),
      transition('closed => open', [
        style({
          visibility: 'visible',
          transform: 'translateY(-100%)',
          opacity: 0
        }),
        animate('300ms ease-out', style({
          transform: 'translateY(0)',
          opacity: 1
        }))
      ]),
      transition('open => closed', [
        animate('200ms ease-in', style({
          transform: 'translateY(-100%)',
          opacity: 0
        })),
        style({ visibility: 'hidden' })
      ])
    ])
  ]
})
export class AccountSettingsOverlayComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

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

  onClose(): void {
    this.close.emit();
  }

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
    // Logic for adding wallet
    console.log('Add wallet clicked');
  }

  createWallet(): void {
    // Logic for creating wallet
    console.log('Create wallet clicked');
  }

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }
}
