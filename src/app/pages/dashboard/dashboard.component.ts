import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor],
})
export class DashboardComponent implements OnInit {
  wallets: any[] = []; // List of wallets
  user: any = {}; // User information

  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router
  ) {}

  ngOnInit(): void {
    // Fetch user and wallet data here
    this.loadUserData();
    this.loadWallets();
  }

  loadUserData() {
    // Assume you have a service or local storage for user data
    this.user = { username: 'JohnDoe', email: 'johndoe@example.com' };
  }

  async loadWallets() {
    const result = await this.walletService.getAllWalletsWithBalances();
    // Get wallets from the wallet service (API or local storage)
    // result.subscribe(
    //   (wallets) => {
    //     console.log('Wallets:', wallets);
    //     this.wallets = wallets;
    //   },
    //   (error) => {
    //     console.error('Error fetching wallets', error);
    //   }
    // );

    this.wallets = result;
  }

  goToWallet(walletId: string) {
    // Navigate to wallet details or send funds page for a specific wallet
    this.router.navigate([`/wallet/${walletId}`]);
  }
}
